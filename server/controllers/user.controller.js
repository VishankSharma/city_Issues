import AppError from "../utils/error.util.js";
import User from "../models/user.model.js";
import cloudinary from "cloudinary";
import fs from "fs/promises";
import sendEmail from "../utils/sendEmail.js";
import crypto from "crypto";

const cookieOption = {
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

// ================= Register =================
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return next(new AppError("All fields are required", 400));
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return next(new AppError("Email already in use", 400));
    }

    const newUser = await User.create({
      name,
      email,
      password,
      role,
      avatar: {
        public_id: email,
        secure_url: "https://res.cloudinary.com/dfwqzjz4j/image/upload",
      },
    });

    // Handle file upload
    if (req.file) {
      try {
        const result = await cloudinary.v2.uploader.upload(req.file.path, {
          folder: "profile",
          width: 250,
          height: 250,
          gravity: "faces",
          crop: "fill",
        });

        newUser.avatar.public_id = result.public_id;
        newUser.avatar.secure_url = result.secure_url;
      } catch (error) {
        return next(new AppError(error.message || "File upload failed", 500));
      } finally {
        // Cleanup local file
        await fs.unlink(req.file.path).catch(() => {});
      }
    }

    await newUser.save();
    newUser.password = undefined;

    const token = newUser.getJwtToken();
    res.cookie("token", token, cookieOption);

    return res.status(201).json({
      success: true,
      message: "User registration successful",
      user: newUser,
      token,
    });
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
};

// ================= Login =================
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return next(new AppError("Email and password are required", 400));
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError("Invalid email or password", 401));
    }

    const token = user.getJwtToken();
    user.password = undefined;

    res.cookie("token", token, cookieOption);

    return res.status(200).json({
      success: true,
      message: "User logged in successfully",
      user,
      token,
    });
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
};

// ================= Logout =================
const logout = (req, res) => {
  res.cookie("token", null, {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    expires: new Date(0),
  });

  return res.status(200).json({
    success: true,
    message: "User logged out successfully",
  });
};

// ================= Get Profile =================
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError("User not found", 404));

    return res.status(200).json({
      success: true,
      message: "User details fetched",
      user,
    });
  } catch (error) {
    return next(new AppError("Failed to fetch profile", 500));
  }
};

// ================= Forgot Password =================
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new AppError("Email is required", 400));

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return next(new AppError("Email not registered", 404));

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetPasswordURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const subject = "Reset Password";
    const message = `
      <p>You can reset your password by clicking the link below:</p>
      <a href="${resetPasswordURL}" target="_blank">Reset your password</a>
      <p>If the above link does not work, copy and paste this in your browser:</p>
      <p>${resetPasswordURL}</p>
      <p>If you did not request this, please ignore.</p>
    `;

    try {
      await sendEmail(email, subject, message);
      return res.status(200).json({
        success: true,
        message: `Reset password link sent to ${email} successfully`,
      });
    } catch (error) {
      user.forgotPasswordToken = undefined;
      user.forgotPasswordExpiry = undefined;
      await user.save({ validateBeforeSave: false });
      return next(new AppError("Email could not be sent", 500));
    }
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
};

// ================= Reset Password =================
const resetPassword = async (req, res, next) => {
  try {
    const { resetToken } = req.params;
    const { password } = req.body;

    const forgotPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const user = await User.findOne({
      forgotPasswordToken,
      forgotPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) return next(new AppError("Invalid or expired token", 400));

    user.password = password;
    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
};

// ================= Change Password =================
const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
      return next(new AppError("Old and new password are required", 400));

    const user = await User.findById(req.user.id).select("+password");
    if (!user) return next(new AppError("User not found! Please login again", 400));

    const isValid = await user.comparePassword(oldPassword);
    if (!isValid) return next(new AppError("Old password is incorrect", 400));

    user.password = newPassword;
    await user.save();

    user.password = undefined;

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
};

// ================= Update User =================
const updateUser = async (req, res, next) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError("User does not exist", 404));

    if (name) user.name = name;

    if (req.file) {
      // Delete previous avatar
      if (user.avatar.public_id) {
        await cloudinary.v2.uploader.destroy(user.avatar.public_id).catch(() => {});
      }

      try {
        const result = await cloudinary.v2.uploader.upload(req.file.path, {
          folder: "profile",
          width: 250,
          height: 250,
          gravity: "faces",
          crop: "fill",
        });

        user.avatar.public_id = result.public_id;
        user.avatar.secure_url = result.secure_url;
      } catch (error) {
        return next(new AppError(error.message || "Avatar upload failed", 500));
      } finally {
        await fs.unlink(req.file.path).catch(() => {}); // cleanup
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "User details updated successfully",
      user,
    });
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
};

export {
  register,
  login,
  logout,
  getProfile,
  forgotPassword,
  resetPassword,
  changePassword,
  updateUser,
};
