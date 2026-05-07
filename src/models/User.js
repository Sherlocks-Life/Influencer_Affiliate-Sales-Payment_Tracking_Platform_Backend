import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "influencer", "finance"],
      default: "influencer"
    },
    brandName: { type: String },
    brandId: { type: String, index: true }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
