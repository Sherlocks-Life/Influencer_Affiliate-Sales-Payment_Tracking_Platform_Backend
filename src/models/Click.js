import mongoose from "mongoose";

const clickSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "Influencer", required: true },
    brandId: { type: String, required: true, index: true },
    referralCode: { type: String, required: true },
    ipAddress: { type: String },
    userAgent: { type: String }
  },
  { timestamps: true }
);

export const Click = mongoose.model("Click", clickSchema);
