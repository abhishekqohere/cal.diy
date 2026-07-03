import Stripe from "stripe";
import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";

const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY;

if (!stripePrivateKey) {
  throw new Error("Missing STRIPE_PRIVATE_KEY");
}

const stripe = new Stripe(stripePrivateKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const paymentIntentId = String(req.body.paymentIntentId);
  const refundRequestId = String(req.body.refundRequestId);
  const amount = Number(req.body.amount);

  // BUG: refund creation is not idempotent.
  // Repeated requests with the same refundRequestId/paymentIntentId can create multiple refunds.
  // There is no Stripe idempotencyKey, existing-refund lookup, unique refund record,
  // transaction guard, retry-safe dedupe, or provider request idempotency option.
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount,
    metadata: {
      source: "qedix-refund-idempotency-test",
      refundRequestId,
      userId: String(session.user.id),
    },
  });

  return res.status(200).json({
    refundId: refund.id,
    status: refund.status,
  });
}
