import express from "express";
import {
  getMyNotifications,
  markNotificationRead,
  markAllAsRead,
  createNotification,
  archiveNotification,
} from "../controllers/notification.controller.js";
import { isLoggedIn, authorizedRoles } from "../middlewares/auth.js";

const router = express.Router();

// ------------------- User / Staff -------------------
router.get("/my", isLoggedIn, getMyNotifications);
router.patch("/:id/read", isLoggedIn, markNotificationRead);
router.patch("/mark-all-read", isLoggedIn, markAllAsRead);
router.delete("/:id", isLoggedIn, archiveNotification);

// ------------------- Admin -------------------
router.post(
  "/create",
  isLoggedIn,
  authorizedRoles("ADMIN"),
  createNotification
);

export default router;
