import Stripe from "stripe";
import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";

const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY;

if (!stripePrivateKey) {
  throw new Error("Missing STRIPE_PRIVATE_KEY");
}

const stripe = new Stripe(stripePrivateKey);

const SERVER_OWNED_PRICE_ID = "price_qedix_server_owned_team_plan";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // BUG: client-controlled quantity is trusted for checkout.
  // Price is server-owned, but quantity is not checked against seats, plan limits,
  // tenant limits, min/max bounds, entitlement rules, or allowed quantity policy.
  const quantity = Number(req.body.quantity);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: SERVER_OWNED_PRICE_ID,
        quantity,
      },
    ],
    success_url: "https://example.com/success",
    cancel_url: "https://example.com/cancel",
    metadata: {
      source: "qedix-client-controlled-quantity-test",
      userId: String(session.user.id),
      requestedQuantity: String(quantity),
    },
  });

  return res.status(200).json({
    checkoutSessionId: checkoutSession.id,
    url: checkoutSession.url,
  });
}
