import Stripe from "stripe";
import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY as string);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // BUG: client-controlled coupon/discount is trusted for checkout.
  // There is no server-side coupon allowlist, plan eligibility check,
  // tenant ownership check, expiry check, usage-limit check, or entitlement validation.
  const priceId = String(req.body.priceId);
  const couponId = String(req.body.couponId);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    discounts: [
      {
        coupon: couponId,
      },
    ],
    success_url: "https://example.com/success",
    cancel_url: "https://example.com/cancel",
    metadata: {
      source: "qedix-client-controlled-coupon-test",
      userId: String(session.user.id),
      requestedCouponId: couponId,
    },
  });

  return res.status(200).json({
    checkoutSessionId: checkoutSession.id,
    url: checkoutSession.url,
  });
}
