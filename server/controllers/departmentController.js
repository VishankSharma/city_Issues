// controllers/departmentController.js
import Department from "../models/department.model.js";
import Issue from "../models/issue.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/error.util.js";

// ================= CREATE DEPARTMENT =================
export const createDepartment = async (req, res, next) => {
  try {
    const { name, description, head } = req.body;

    if (!name || !description || !head) {
      return next(new AppError("All fields are required", 400));
    }

    const headUser = await User.findById(head);
    if (!headUser) {
      return next(new AppError("Head user not found", 404));
    }

    const department = await Department.create({ name, description, head });

    res.status(201).json({
      success: true,
      message: "Department created successfully",
      department,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// ================= GET ALL DEPARTMENTS =================
export const getDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find()
      .populate("head", "name email role")
      .populate("staff", "name email role")
      .populate("issues", "title status priority");

    res.status(200).json({
      success: true,
      count: departments.length,
      departments,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// ================= GET DEPARTMENT BY ID =================
export const getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id)
      .populate("head", "name email role")
      .populate("staff", "name email role")
      .populate("issues");

    if (!department) {
      return next(new AppError("Department not found", 404));
    }

    res.status(200).json({
      success: true,
      department,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// ================= UPDATE DEPARTMENT =================
export const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const department = await Department.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!department) {
      return next(new AppError("Department not found", 404));
    }

    res.status(200).json({
      success: true,
      message: "Department updated successfully",
      department,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// ================= DELETE DEPARTMENT =================
export const deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id);
    if (!department) {
      return next(new AppError("Department not found", 404));
    }

    // 🔹 Optional: Reassign staff/issues if needed

    await department.deleteOne();

    res.status(200).json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// ================= ASSIGN STAFF TO DEPARTMENT =================
export const assignStaffToDepartment = async (req, res, next) => {
  try {
    const { deptId, staffId } = req.body;

    const department = await Department.findById(deptId);
    if (!department) {
      return next(new AppError("Department not found", 404));
    }

    const staffUser = await User.findById(staffId);
    if (!staffUser || staffUser.role !== "STAFF") {
      return next(new AppError("Invalid staff user", 400));
    }

    if (department.staff.includes(staffId)) {
      return next(new AppError("Staff already assigned", 400));
    }

    department.staff.push(staffId);
    await department.save();

    res.status(200).json({
      success: true,
      message: "Staff assigned successfully",
      department,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// ================= REMOVE STAFF FROM DEPARTMENT =================
export const removeStaffFromDepartment = async (req, res, next) => {
  try {
    const { deptId, staffId } = req.body;

    const department = await Department.findById(deptId);
    if (!department) {
      return next(new AppError("Department not found", 404));
    }

    department.staff = department.staff.filter(
      (id) => id.toString() !== staffId.toString()
    );

    await department.save();

    res.status(200).json({
      success: true,
      message: "Staff removed successfully",
      department,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// ================= GET DEPARTMENT ISSUES =================
export const getDepartmentIssues = async (req, res, next) => {
  try {
    const { deptId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    const department = await Department.findById(deptId);
    if (!department) {
      return next(new AppError("Department not found", 404));
    }

    const filter = { department: deptId };
    if (status) filter.status = status;

    const issues = await Issue.find(filter)
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email role")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Issue.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: issues.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      issues,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
