import Department from "../models/department.model.js";
import Issue from "../models/issue.model.js";

// 📊 Get overall city analytics
export const getCityAnalytics = async (req, res, next) => {
  try {
    const totalIssues = await Issue.countDocuments();
    const resolvedIssues = await Issue.countDocuments({ status: "RESOLVED" });

    const avgResolution = await Issue.aggregate([
      { $match: { status: "RESOLVED" } },
      {
        $project: {
          resolutionTime: { $subtract: ["$updatedAt", "$createdAt"] },
        },
      },
      { $group: { _id: null, avg: { $avg: "$resolutionTime" } } },
    ]);

    res.json({
      success: true,
      totalIssues,
      resolvedIssues,
      avgResolutionTime:
        avgResolution.length > 0
          ? (avgResolution[0].avg / (1000 * 60 * 60)).toFixed(2) + " hrs"
          : "N/A",
    });
  } catch (err) {
    next(err);
  }
};

// 📊 Get analytics by Department
export const getDepartmentAnalytics = async (req, res, next) => {
  try {
    const departments = await Department.find().populate("issues");

    const data = departments.map((dept) => {
      const total = dept.issues.length;
      const resolved = dept.issues.filter((i) => i.status === "RESOLVED").length;

      return {
        id: dept.id,
        name: dept.name,
        description: dept.description,
        totalIssues: total,
        resolvedIssues: resolved,
        pendingIssues: total - resolved,
      };
    });

    res.json({ success: true, departments: data });
  } catch (err) {
    next(err);
  }
};

// 📊 Issues by category
export const getIssueCategoryStats = async (req, res, next) => {
  try {
    const stats = await Issue.aggregate([
      { $group: { _id: "$category", total: { $sum: 1 } } },
    ]);

    res.json({ success: true, categories: stats });
  } catch (err) {
    next(err);
  }
};
