import Issue from "../models/issue.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/error.util.js";
import { uploads } from "../middlewares/cloudinary.js"; // ✅ only import uploads
import cloudinary from "../middlewares/cloudinary.js";   // ✅ still keep for destroy
import fs from "fs/promises";

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

    // Prevent duplicate active issues at same location
    const existing = await Issue.findOne({
      "location.coordinates": [parsedLng, parsedLat],
      status: { $in: ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"] },
    });

    if (existing) {
      return next(
        new AppError(
          "An active issue at this location already exists. You cannot create a new one.",
          400
        )
      );
    }

    console.log("Files being uploaded:", req.files);


    // Upload media to Cloudinary
    const uploadedMedia = [];
    if (req.files?.length) {
      for (const file of req.files) {
        if (!file.path) continue; // skip if path missing
        
        const result = await uploads(file.path, "issues");
        console.log(result);

        uploadedMedia.push({
          type: file.mimetype.startsWith("video") ? "VIDEO" : "IMAGE",
          public_id: result.public_id,
          secure_url: result.secure_url,
        });

        // remove local file
        await fs.unlink(file.path);
      }
    }

    // Create new issue
    const issue = await Issue.create({
      title,
      description,
      category,
      location: { type: "Point", coordinates: [parsedLng, parsedLat] },
      address,
      createdBy: req.user.id,
      media: uploadedMedia,
    });

    // Link issue to user
    await User.findByIdAndUpdate(req.user.id, { $push: { issues: issue.id } });

    return res.status(201).json({
      success: true,
      message: "Issue created successfully",
      issue,
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ================= Get Issues with Filters + Stats =================
const getIssues = async (req, res, next) => {
  try {
    const { status, category, priority, q, page = 1, limit = 10, sort = "-createdAt", near, bbox } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (q) filter.$text = { $search: q };

    if (near) {
      const [lat, lng, radius] = near.split(",");
      filter.location = {
        $geoWithin: {
          $centerSphere: [[parseFloat(lng), parseFloat(lat)], parseFloat(radius) / 6378.1],
        },
      };
    }

    if (bbox) {
      const [lng1, lat1, lng2, lat2] = bbox.split(",");
      filter.location = {
        $geoWithin: { $box: [[parseFloat(lng1), parseFloat(lat1)], [parseFloat(lng2), parseFloat(lat2)]] },
      };
    }

    // ---------- Issues with pagination ----------
    const issues = await Issue.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("createdBy", "name avatar")
      .populate("assignedTo", "name role");

    // ---------- Stats ----------
    const stats = await Issue.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Transform aggregation result into object
    let counts = { total: 0, PENDING: 0, RESOLVED: 0, ACKNOWLEDGED: 0, IN_PROGRESS: 0 };
    stats.forEach(s => {
      counts[s._id] = s.count;
      counts.total += s.count;
    });

    res.json({
      success: true,
      issues,
      counts,
    });
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

    if (!issue) return next(new AppError("Issue not found", 404));

    res.json({ success: true, issue });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// Allowed status flow order
const statusOrder = ["PENDING", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"];

// update issue 
const updateIssue = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return next(new AppError("Issue not found", 404));

    const user = req.user;

    // Citizen restrictions
    if (user.role === "CITIZEN") {
      const isOwner = issue.createdBy.toString() === user.id;
      const isAcknowledged = ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"].includes(issue.status);

      if (!isOwner) return next(new AppError("You can only update your own issues", 403));
      if (isAcknowledged) return next(new AppError("Cannot edit issue after acknowledgment", 403));
    }

    const oldStatus = issue.status;
    const newStatus = req.body.status || oldStatus;

    // 🚨 Enforce increasing order
    const oldIndex = statusOrder.indexOf(oldStatus);
    const newIndex = statusOrder.indexOf(newStatus);

    if (newIndex < oldIndex) {
      return next(new AppError(`Status cannot move backwards (current: ${oldStatus}, attempted: ${newStatus})`, 400));
    }
    if (newIndex > oldIndex + 1) {
      return next(new AppError(`Invalid status jump (must go step by step from ${oldStatus})`, 400));
    }

    // Handle media update
    if (req.files?.length) {
      for (const media of issue.media) {
        if (media.public_id) {
          await cloudinary.uploader.destroy(media.public_id, {
            resource_type: media.type === "VIDEO" ? "video" : "image",
          });
        }
      }

      const uploadedMedia = [];
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
      issue.media = uploadedMedia;
    }

    // Update other fields
    Object.assign(issue, req.body);
    await issue.save();

    // 🚀 Give +1 point only on first time ACKNOWLEDGED
    if (oldStatus === "PENDING" && issue.status === "ACKNOWLEDGED") {
      await User.findByIdAndUpdate(issue.createdBy, { $inc: { points: 1 } });
    }

    res.status(200).json({
      success: true,
      message: "Issue updated successfully",
      issue,
    });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};


export { createIssue, getIssues, getIssueById, updateIssue };
