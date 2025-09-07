import Issue from "../models/issue.model.js";
import User from "../models/user.model.js";
import Department from "../models/department.model.js";
import AppError from "../utils/error.util.js";
import { uploads } from "../middlewares/cloudinary.js";
import cloudinary from "../middlewares/cloudinary.js";
import fs from "fs/promises";
import { sendNotification } from "../utils/notify.util.js";

// ✅ Status flow
const statusOrder = ["PENDING", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "REJECTED"];

// ================= Create New Issue =================
const createIssue = async (req, res, next) => {
  try {
    const { title, description, category, lat, lng, address } = req.body;

    if (!title || !description || !category || !lat || !lng || !address) {
      return next(new AppError("All fields are required", 400));
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      return next(new AppError("Latitude or longitude is out of bounds", 400));
    }

    // ✅ Auto-assign department from category (DB lookup)
    const dept = await Department.findOne({ categories: category });
    if (!dept) {
      return next(new AppError(`No department found handling category: ${category}`, 404));
    }

    // Prevent duplicate active issues at same location
    const existing = await Issue.findOne({
      "location.coordinates": [parsedLng, parsedLat],
      status: { $in: ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"] },
    });
    if (existing) {
      return next(new AppError("An active issue at this location already exists.", 400));
    }

    // ✅ Upload media
    const uploadedMedia = [];
    if (req.files?.length) {
      for (const file of req.files) {
        if (!file.path) continue;
        const result = await uploads(file.path, "issues");
        uploadedMedia.push({
          type: file.mimetype.startsWith("video") ? "VIDEO" : "IMAGE",
          public_id: result.public_id,
          secure_url: result.secure_url,
        });
        await fs.unlink(file.path);
      }
    }

    // ✅ Create issue
    const issue = await Issue.create({
      title,
      description,
      category,
      department: dept._id,
      location: { type: "Point", coordinates: [parsedLng, parsedLat] },
      address,
      createdBy: req.user.id,
      media: uploadedMedia,
    });

    // Link to user
    await User.findByIdAndUpdate(req.user.id, { $push: { issues: issue.id } });

    // Link to department
    await Department.findByIdAndUpdate(dept._id, {
      $inc: { totalIssues: 1 },
      $push: { issues: issue._id },
    });

    res.status(201).json({ success: true, message: "Issue created successfully", issue });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ================= Get Issues with Filters + Stats =================
const getIssues = async (req, res, next) => {
  try {
    const { status, category, priority, q, page = 1, limit = 10, sort = "-createdAt" } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (q) filter.$text = { $search: q };

    const issues = await Issue.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("createdBy", "name avatar")
      .populate("assignedTo", "name role")
      .populate("department", "name");

    const stats = await Issue.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    let counts = { total: 0, PENDING: 0, ACKNOWLEDGED: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0 };
    stats.forEach(s => {
      counts[s._id] = s.count;
      counts.total += s.count;
    });

    res.json({ success: true, issues, counts });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ================= Get My All Issues =================
const getMyAllIssues = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const issues = await Issue.find({ createdBy: userId })
      .sort("-createdAt")
      .populate("assignedTo", "name role")
      .populate("createdBy", "name avatar")
      .populate("department", "name");

    const stats = await Issue.aggregate([
      { $match: { createdBy: req.user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    let counts = { total: issues.length, PENDING: 0, ACKNOWLEDGED: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0 };
    stats.forEach(s => { counts[s._id] = s.count; });

    res.json({ success: true, issues, counts });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ================= Get Issue by ID =================
const getIssueById = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate("createdBy", "name avatar")
      .populate("assignedTo", "name role")
      .populate("department", "name");

    if (!issue) return next(new AppError("Issue not found", 404));
    res.json({ success: true, issue });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ================= Update Issue =================
const updateIssue = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id).populate("department");
    if (!issue) return next(new AppError("Issue not found", 404));

    const user = req.user;

    // Citizen restriction
    if (user.role === "CITIZEN") {
      const isOwner = issue.createdBy.toString() === user.id;
      const isAcknowledged = ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "REJECTED"].includes(issue.status);

      if (!isOwner) return next(new AppError("You can only update your own issues", 403));
      if (isAcknowledged) return next(new AppError("Cannot edit issue after acknowledgment", 403));

      const allowedFields = ["title", "description", "media", "category", "address"];
      Object.keys(req.body).forEach((key) => {
        if (!allowedFields.includes(key)) delete req.body[key];
      });
    }

    const oldStatus = issue.status;
    const newStatus = req.body.status || oldStatus;
    const oldIndex = statusOrder.indexOf(oldStatus);
    const newIndex = statusOrder.indexOf(newStatus);

    if (newIndex < oldIndex) return next(new AppError("Status cannot move backwards", 400));
    if (newIndex > oldIndex + 1) return next(new AppError("Invalid status jump", 400));

    // ✅ If category changed → auto-update department (DB lookup)
    if (req.body.category && req.body.category !== issue.category) {
      const newDept = await Department.findOne({ categories: req.body.category });
      if (newDept) {
        issue.department = newDept._id;
      }
    }

    // ✅ Handle media update
    if (req.files?.length) {
      const newMedia = [];
      for (const file of req.files) {
        if (!file.path) continue;
        const result = await uploads(file.path, "issues");
        newMedia.push({
          type: file.mimetype.startsWith("video") ? "VIDEO" : "IMAGE",
          public_id: result.public_id,
          secure_url: result.secure_url,
        });
        await fs.unlink(file.path);
      }

      for (const media of issue.media) {
        if (media.public_id) {
          await cloudinary.uploader.destroy(media.public_id, {
            resource_type: media.type === "VIDEO" ? "video" : "image",
          });
        }
      }
      issue.media = newMedia;
    }

    Object.assign(issue, req.body);
    await issue.save();

    // ✅ Department stats update on resolve
    if (oldStatus !== "RESOLVED" && issue.status === "RESOLVED") {
      const resolutionTime = (Date.now() - issue.createdAt.getTime()) / (1000 * 60);
      const dept = await Department.findById(issue.department._id);
      if (dept) {
        dept.resolvedIssues += 1;
        dept.avgResolutionTime = ((dept.avgResolutionTime * (dept.resolvedIssues - 1)) + resolutionTime) / dept.resolvedIssues;
        await dept.save();
      }
    }

    // ✅ Wallet reward on first acknowledgment
    if (oldStatus === "PENDING" && issue.status === "ACKNOWLEDGED") {
      const updatedUser = await User.findByIdAndUpdate(
        issue.createdBy,
        {
          $inc: { "wallet.balance": 1 },
          $push: { "wallet.transactions": { coins: 1, description: "Reward for issue acknowledged" } },
        },
        { new: true }
      );
      await sendNotification(updatedUser._id, "Reward Credited 🎉", "You earned +1 coin for your issue being acknowledged.", "WALLET", req.app.get("io"));
    }

    // ✅ Notify on status change
    if (oldStatus !== issue.status) {
      await sendNotification(
        issue.createdBy,
        "Issue Update",
        `Your issue "${issue.title}" is now ${issue.status}`,
        "ISSUE",
        req.app.get("io")
      );
    }

    req.app.get("io").emit("issueUpdated", issue);

    res.status(200).json({ success: true, message: "Issue updated successfully", issue });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

export { createIssue, getIssues, getMyAllIssues, getIssueById, updateIssue };
