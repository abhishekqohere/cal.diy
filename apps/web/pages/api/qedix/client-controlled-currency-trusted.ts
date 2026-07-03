import Stripe from "stripe";
import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";

const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY;

if (!stripePrivateKey) {
  throw new Error("Missing STRIPE_PRIVATE_KEY");
}

const stripe = new Stripe(stripePrivateKey);

const SERVER_OWNED_AMOUNT_CENTS = 2500;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // BUG: client-controlled currency is trusted for payment creation.
  // Amount is server-owned, but currency is taken from req.body.
  // There is no server-side allowed currency list, country/plan compatibility check,
  // minor-unit validation, zero-decimal currency handling, or server-owned pricing source.
  const currency = String(req.body.currency);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: SERVER_OWNED_AMOUNT_CENTS,
    currency,
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      source: "qedix-client-controlled-currency-test",
      userId: String(session.user.id),
      requestedCurrency: currency,
    },
  });

  return res.status(200).json({
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
  });
}
