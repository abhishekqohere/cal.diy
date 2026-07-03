import Stripe from "stripe";
import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY ?? "");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // BUG: client-controlled amount is trusted for payment creation.
  // There is no server-side lookup of product/plan/booking price.
  // There is no minimum/maximum check or allowed price table validation.
  const amount = Number(req.body.amount);
  const currency = String(req.body.currency ?? "usd");

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      source: "qedix-client-controlled-amount-test",
      userId: String(session.user.id),
    },
  });

  return res.status(200).json({
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
  });
}
