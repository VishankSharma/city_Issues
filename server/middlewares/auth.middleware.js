import AppError from "../utils/error.util.js";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// ✅ Check if user is logged in
const isLoggedIn = async (req, res, next) => {
  try {
    const { token } = req.cookies;

    if (!token) {
      return next(new AppError("Unauthenticated, please login again", 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🟢 Fetch fresh user from DB so that role, avatar, etc are always latest
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError("User no longer exists", 401));
    }

    req.user = user; // pure user object available everywhere
    next();
  } catch (error) {
    return next(new AppError("Invalid or expired token, please login again", 401));
  }
};

// ✅ Role based authorization
const authorizedRoles = (...roles) => (req, res, next) => {
  const currentUserRole = req.user?.role;

  if (!roles.includes(currentUserRole)) {
    return next(
      new AppError("You do not have permission to perform this action", 403)
    );
  }

  next();
};

export { isLoggedIn, authorizedRoles };
