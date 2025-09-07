import { Schema, model } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// ================= Sub-schemas =================
const transactionSchema = new Schema({
  description: { type: String, required: true },
  coins: { type: Number, required: true }, // +ve earn, -ve spend
  date: { type: Date, default: Date.now },
});

const achievementSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  unlockedAt: { type: Date, default: Date.now },
});

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

    isVerified: { type: Boolean, default: false },

    // 🚀 Wallet system (coins, transactions, achievements)
    wallet: {
      balance: { type: Number, default: 0, min: 0 },
      transactions: [transactionSchema],
      achievements: [achievementSchema],
    },

    // ✅ Forgot Password
    forgotPasswordToken: String,
    forgotPasswordExpiry: Date,

    // ✅ Track all issues created by this user
    issues: [{ type: Schema.Types.ObjectId, ref: "Issue" }],

    // ✅ For Staff members (optional)
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id; // replace _id with id
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
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
  getJwtToken() {
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET not defined");
    return jwt.sign(
      { id: this._id, email: this.email, role: this.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "1d" }
    );
  },

  async comparePassword(plainPassword) {
    return await bcrypt.compare(plainPassword, this.password);
  },

  getResetPasswordToken() {
    const resetToken = crypto.randomBytes(32).toString("hex");
    this.forgotPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    this.forgotPasswordExpiry =
      Date.now() + (parseInt(process.env.RESET_TOKEN_EXPIRE) || 15) * 60 * 1000;

    return resetToken;
  },
};

const User = model("User", userSchema);
export default User;
