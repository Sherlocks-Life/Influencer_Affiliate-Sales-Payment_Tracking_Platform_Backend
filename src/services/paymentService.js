import Razorpay from "razorpay";
import crypto from "crypto";

const enabled = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
const razorpay = enabled
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })
  : null;

export function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID || "";
}

export async function createOrder({ amount, receipt, notes }) {
  if (!razorpay) {
    return { id: `mock_order_${Date.now()}`, amount: Math.round(amount * 100), currency: "INR", receipt };
  }
  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt,
    notes
  });
  return order;
}

export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!razorpay) return true;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const generated = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return generated === signature;
}

export async function createPayout({ amount, referenceId }) {
  if (!razorpay) {
    return { id: `mock_payout_${referenceId}`, mode: "mock" };
  }

  const payout = await razorpay.payouts.create({
    account_number: "23232300852323",
    amount: Math.round(amount * 100),
    currency: "INR",
    mode: "UPI",
    purpose: "payout",
    queue_if_low_balance: true,
    reference_id: referenceId,
    narration: "Influencer commission payout"
  });
  return { id: payout.id, mode: "razorpay" };
}
