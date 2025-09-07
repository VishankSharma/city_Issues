import express from "express";
import { isLoggedIn, authorizedRoles } from "../middlewares/auth.middleware.js";
import {
  getCityAnalytics,
  getDepartmentAnalytics,
  getIssueCategoryStats,
} from "../controllers/analyticsController.js";

const router = express.Router();

// Only Admin + Staff can see analytics
router.get(
  "/city",
  isLoggedIn,
  authorizedRoles("ADMIN", "STAFF"),
  getCityAnalytics
);

router.get(
  "/departments",
  isLoggedIn,
  authorizedRoles("ADMIN", "STAFF"),
  getDepartmentAnalytics
);

router.get(
  "/categories",
  isLoggedIn,
  authorizedRoles("ADMIN", "STAFF"),
  getIssueCategoryStats
);

export default router;
