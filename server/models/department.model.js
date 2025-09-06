import { Schema, model } from "mongoose";

const departmentSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },

    // ✅ Department Head (Admin ya Senior Staff)
    head: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    // ✅ Staff Members in this Department
    staff: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ✅ Issues handled by this department
    issues: [
      {
        type: Schema.Types.ObjectId,
        ref: "Issue",
      },
    ],

    // ✅ KPIs / Analytics fields
    totalIssues: {
      type: Number,
      default: 0,
    },
    resolvedIssues: {
      type: Number,
      default: 0,
    },
    avgResolutionTime: {
      type: Number, // in hours (or ms)
      default: 0,
    },
  },
  { timestamps: true }
);

const Department = model("Department", departmentSchema);

export default Department;
