// models/department.model.js
import { Schema, model } from "mongoose";

const departmentSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: String,
    head: { type: Schema.Types.ObjectId, ref: "User" },
    staff: [{ type: Schema.Types.ObjectId, ref: "User" }],
    issues: [{ type: Schema.Types.ObjectId, ref: "Issue" }],
    
    // ✅ Add categories handled by this department
    categories: [{ type: String, required: true }],

    // Stats
    totalIssues: { type: Number, default: 0 },
    resolvedIssues: { type: Number, default: 0 },
    avgResolutionTime: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default model("Department", departmentSchema);
