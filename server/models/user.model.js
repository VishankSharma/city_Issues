import { Schema, model } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// ================= User Schema =================
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      minlength: [3, "Name must be at least 3 characters"],
      maxlength: [30, "Name should be less than 30 characters"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i,
        "Please enter a valid email address",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },

    avatar: {
      public_id: { type: String, default: null },
      secure_url: { type: String, default: null },
    },

    role: {
      type: String,
      enum: ["CITIZEN", "ADMIN", "STAFF"],
      default: "CITIZEN",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    // 🚀 Points for citizen contribution
    points: {
      type: Number,
      default: 0,
    },

    // ✅ Forgot Password
    forgotPasswordToken: String,
    forgotPasswordExpiry: Date,

    // ✅ Track all issues created by this user
    issues: [
      {
        type: Schema.Types.ObjectId,
        ref: "Issue",
      },
    ],

    // ✅ For Staff members (optional)
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
  },
  { timestamps: true }
);

// ================= Middleware =================
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// ================= Instance Methods =================
userSchema.methods = {
  // 🔑 Generate JWT
  getJwtToken() {
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET not defined");
    return jwt.sign(
      { id: this._id, email: this.email, role: this.role, avatar: this.avatar },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "1d" }
    );
  },

  // 🔑 Compare Password
  async comparePassword(plainPassword) {
    return await bcrypt.compare(plainPassword, this.password);
  },

  // 🔑 Generate Reset Password Token
  getResetPasswordToken() {
    const resetToken = crypto.randomBytes(32).toString("hex");

    this.forgotPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const resetExpiry =
      (parseInt(process.env.RESET_TOKEN_EXPIRE) || 15) * 60 * 1000;

    this.forgotPasswordExpiry = Date.now() + resetExpiry;

    return resetToken;
  },
};

// ================= Model =================
const User = model("User", userSchema);
export default User;
