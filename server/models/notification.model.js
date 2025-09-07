import { Schema, model } from "mongoose";

const notificationSchema = new Schema(
  {
    recipientUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    recipientDepartment: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    issue: {
      type: Schema.Types.ObjectId,
      ref: "Issue",
      default: null,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["ISSUE", "WALLET", "SYSTEM"],
      default: "SYSTEM",
    },
    isRead: { type: Boolean, default: false }, // for personal notifications
    isReadBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],
    isArchived: { type: Boolean, default: false }, // for citizen
    isArchivedBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        archivedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// ✅ Transform `_id → id` in API responses
notificationSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;

    if (ret.recipientUser?._id) {
      ret.recipientUser.id = ret.recipientUser._id;
      delete ret.recipientUser._id;
    }
    if (ret.recipientDepartment?._id) {
      ret.recipientDepartment.id = ret.recipientDepartment._id;
      delete ret.recipientDepartment._id;
    }
    if (ret.issue?._id) {
      ret.issue.id = ret.issue._id;
      delete ret.issue._id;
    }

    return ret;
  },
});

export default model("Notification", notificationSchema);
