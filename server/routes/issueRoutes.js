import express from "express";
import { isLoggedIn, authorizedRoles } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.middleware.js";

import {
  createIssue,
  getIssues,
  updateIssue,
  getIssueById,
} from "../controllers/issueController.js";

const router = express.Router();

// Citizen creates new issue → media → Cloudinary
router.post(
  "/",
  isLoggedIn,
  authorizedRoles("CITIZEN"), // only citizens create
  upload.array("media", 5),
  createIssue
);

// Admin/Staff fetch all issues (with filters & pagination)
router.get(
  "/",
  isLoggedIn,
  authorizedRoles("ADMIN", "STAFF","CITIZEN"),
  getIssues
);

// Public: get issue by ID
router.get("/:id", getIssueById);

// Update issue (citizen can update their own, staff/admin can update any)
router.put(
  "/:id",
  isLoggedIn,
  authorizedRoles("CITIZEN", "STAFF", "ADMIN"),
  upload.array("media", 5),
  updateIssue
);

export default router;
