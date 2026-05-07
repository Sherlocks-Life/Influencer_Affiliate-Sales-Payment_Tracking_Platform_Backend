import mongoose from "mongoose";

const influencerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    brandId: { type: String, required: true, index: true },
    displayName: { type: String, required: true },
    referralCode: { type: String, required: true, unique: true },
    payoutUpi: { type: String }
  },
  { timestamps: true }
);

export const Influencer = mongoose.model("Influencer", influencerSchema);
