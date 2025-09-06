import express from "express";
import {
    createDepartment,
    getDepartments,
    getDepartmentById,
    updateDepartment,
    deleteDepartment,
    assignStaffToDepartment,
    removeStaffFromDepartment,
    getDepartmentIssues,
} from "../controllers/departmentController.js";

import { isLoggedIn, authorizedRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Create Department
router.post(
    "/",
    isLoggedIn,
    authorizedRoles("ADMIN"),
    createDepartment
);

// Get All Departments
router.get(
    "/",
    isLoggedIn,
    authorizedRoles("ADMIN"),
    getDepartments
);

// Get Department by ID (with staff, head, issues)
router.get(
    "/:id",
    isLoggedIn,
    authorizedRoles("ADMIN", "STAFF"),
    getDepartmentById
);

// Update Department
router.put(
    "/:id",
    isLoggedIn,
    authorizedRoles("ADMIN"),
    updateDepartment
);

// Delete Department
router.delete(
    "/:id",
    isLoggedIn,
    authorizedRoles("ADMIN"),
    deleteDepartment
);

// Assign Staff to Department
router.put(
    "/:id/assign-staff/:staffId",
    isLoggedIn,
    authorizedRoles("ADMIN"),
    assignStaffToDepartment
);

// Remove Staff from Department
router.put(
    "/:id/remove-staff/:staffId",
    isLoggedIn,
    authorizedRoles("ADMIN"),
    removeStaffFromDepartment
);

// Get Issues of a Department
router.get(
    "/:id/issues",
    isLoggedIn,
    authorizedRoles("ADMIN", "STAFF"),
    getDepartmentIssues
);

export default router;
