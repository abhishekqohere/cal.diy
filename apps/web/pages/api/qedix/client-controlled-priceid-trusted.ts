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

  // BUG: client-controlled priceId and quantity are trusted for checkout.
  // There is no server-side allowed price catalog lookup, plan lookup,
  // tenant ownership check, product entitlement mapping, or quantity limit.
  const priceId = String(req.body.priceId);
  const quantity = Number(req.body.quantity ?? 1);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity,
      },
    ],
    success_url: "https://example.com/success",
    cancel_url: "https://example.com/cancel",
    metadata: {
      source: "qedix-client-controlled-priceid-test",
      userId: String(session.user.id),
      requestedPriceId: priceId,
    },
  });

  return res.status(200).json({
    checkoutSessionId: checkoutSession.id,
    url: checkoutSession.url,
  });
}
