import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/error.util.js";

// ================= Get My Notifications =================
export const getMyNotifications = async (req, res, next) => {
  try {
    const user = req.user;
    const deptId = user.department;

    // Personal notifications
    const personal = await Notification.find({
      recipientUser: user.id,
      isArchived: false,
    })
      .populate("issue", "title status")
      .sort("-createdAt")
      .limit(50)
      .lean();

    // Department notifications
    let deptNotifs = [];
    if (deptId) {
      deptNotifs = await Notification.find({
        recipientDepartment: deptId,
        isArchivedBy: { $not: { $elemMatch: { user: user._id } } },
      })
        .populate("issue", "title status")
        .sort("-createdAt")
        .limit(50)
        .lean();
    }

    const mappedDeptNotifs = deptNotifs.map((n) => ({
      ...n,
      isRead:
        n.isReadBy?.some(
          (x) => x.user?.toString() === user._id.toString()
        ) || false,
    }));

    res.json({ success: true, personal, department: mappedDeptNotifs });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ================= Mark Single Notification as Read =================
export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notif = await Notification.findById(id);
    if (!notif) return next(new AppError("Notification not found", 404));

    if (notif.recipientUser?.toString() === userId) {
      if (!notif.isRead) {
        notif.isRead = true;
        await notif.save();
      }
    } else if (notif.recipientDepartment) {
      notif.isReadBy = notif.isReadBy || [];
      if (
        !notif.isReadBy.some((x) => x.user?.toString() === req.user._id.toString())
      ) {
        notif.isReadBy.push({ user: req.user._id, readAt: new Date() });
        await notif.save();
      }
    } else {
      return next(new AppError("Not authorized to mark this notification", 403));
    }

    res.json({ success: true, message: "Marked read" });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ================= Mark All Notifications as Read =================
export const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const deptId = req.user.department;

    // Personal notifications
    await Notification.updateMany(
      { recipientUser: userId, isRead: false },
      { $set: { isRead: true } }
    );

    // Department notifications
    if (deptId) {
      await Notification.updateMany(
        {
          recipientDepartment: deptId,
          "isReadBy.user": { $ne: req.user._id },
        },
        { $push: { isReadBy: { user: req.user._id, readAt: new Date() } } }
      );
    }

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ================= Admin Creates Notification =================
export const createNotification = async (req, res, next) => {
  try {
    const { title, message, role, userId, departmentId } = req.body;

    if (!title || !message)
      return next(new AppError("Title & message required", 400));

    let users = [];

    if (userId) {
      const user = await User.findById(userId);
      if (!user) return next(new AppError("User not found", 404));
      users = [user];
    } else if (role || departmentId) {
      let filter = {};
      if (role && role !== "ALL") filter.role = role;
      if (departmentId) filter.department = departmentId;
      users = await User.find(filter);
    } else {
      return next(new AppError("Provide either userId, role or departmentId", 400));
    }

    const notifications = [];
    const io = req.app.get("io");

    for (const u of users) {
      const notifData = { title, message, type: "SYSTEM" };
      if (u._id) notifData.recipientUser = u._id;
      if (departmentId) notifData.recipientDepartment = departmentId;

      const notif = await Notification.create(notifData);
      if (io) io.to(u._id.toString()).emit("notification", notif);
      notifications.push(notif);
    }

    res.status(201).json({
      success: true,
      message: "Notifications sent successfully",
      count: notifications.length,
    });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ================= Delete / Archive Notification =================
export const archiveNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notif = await Notification.findById(id);
    if (!notif) return next(new AppError("Notification not found", 404));

    if (
      req.user.role === "CITIZEN" &&
      notif.recipientUser?.toString() === userId
    ) {
      notif.isArchived = true;
      await notif.save();
      return res.json({ success: true, message: "Notification deleted" });
    }

    if (req.user.role === "STAFF" && notif.recipientDepartment) {
      notif.isArchivedBy = notif.isArchivedBy || [];
      if (
        !notif.isArchivedBy.some(
          (x) => x.user?.toString() === req.user._id.toString()
        )
      ) {
        notif.isArchivedBy.push({
          user: req.user._id,
          archivedAt: new Date(),
        });
        await notif.save();
      }
      return res.json({ success: true, message: "Notification cleared for you" });
    }

    if (req.user.role === "ADMIN") {
      await notif.deleteOne();
      return res.json({
        success: true,
        message: "Notification deleted by admin",
      });
    }

    return next(new AppError("Not authorized to delete this notification", 403));
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};
