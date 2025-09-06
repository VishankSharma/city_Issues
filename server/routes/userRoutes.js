import express from "express";
const router = express.Router();

import {
  register,
  login,
  logout,
  getProfile,
  forgotPassword,
  resetPassword,
  changePassword,
  updateUser,
} from "../controllers/user.controller.js";

import { isLoggedIn} from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.middleware.js";


// ✅ Auth Routes
// avatar → direct Cloudinary via buffer
router.post("/register", upload.single("avatar"), register);

router.post("/login", login);
router.get("/logout",isLoggedIn, logout);

// ✅ User Profile
router.get("/me", isLoggedIn, getProfile);

// ✅ Password Management
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:resetToken", resetPassword);
router.put("/change-password", isLoggedIn, changePassword);

// ✅ Update Profile
router.put("/update", isLoggedIn, upload.single("avatar"), updateUser);

export default router;
