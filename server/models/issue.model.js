import { Schema, model } from "mongoose";

// ================= Issue Schema =================
const issueSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Issue title is required"],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: [true, "Issue description is required"],
      maxlength: 1000,
    },
    category: {
      type: String,
      enum: ["POTHOLE", "STREETLIGHT", "GARBAGE", "WATER", "OTHER"],
      required: true,
    },
    media: [
      {
        type: { type: String, enum: ["IMAGE", "VIDEO"], required: true },
        public_id: { type: String },
        secure_url: { type: String },
      },
    ],
    address: { type: String, required: true },

    // ✅ GeoJSON location
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    // ✅ Workflow status
    status: {
      type: String,
      enum: [
        "PENDING",      // just created
        "ACKNOWLEDGED", // accepted by staff/admin
        "IN_PROGRESS",  // work is ongoing
        "RESOLVED",     // issue fixed
        "REJECTED",     // invalid or duplicate
      ],
      default: "PENDING",
    },

    // ✅ Priority
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
    },

    // ✅ Relations
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User", // STAFF id
    },
    
    // ✅ Track department (for STAFF assignment)
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    // ✅ Track when issue was resolved (for SLA analytics)
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ================= Indexes =================
issueSchema.index({ location: "2dsphere" });

// ================= Transform `_id` to `id` =================
issueSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;

    // For createdBy and assignedTo
    if (ret.createdBy?._id) {
      ret.createdBy.id = ret.createdBy._id;
      delete ret.createdBy._id;
    }
    if (ret.assignedTo?._id) {
      ret.assignedTo.id = ret.assignedTo._id;
      delete ret.assignedTo._id;
    }

    return ret;
  },
});

// ================= Model =================
const Issue = model("Issue", issueSchema);
export default Issue;
