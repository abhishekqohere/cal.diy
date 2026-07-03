import Stripe from "stripe";
import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";

const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY;

if (!stripePrivateKey) {
  throw new Error("Missing STRIPE_PRIVATE_KEY");
}

const stripe = new Stripe(stripePrivateKey);

const SERVER_OWNED_BOOKING_PRICE_CENTS = 2500;
const SERVER_OWNED_CURRENCY = "usd";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const bookingId = String(req.body.bookingId);

  // BUG: payment creation is not idempotent.
  // Repeated requests for the same bookingId create multiple PaymentIntents.
  // There is no idempotencyKey, existing-payment lookup, unique order/payment record,
  // transaction guard, retry-safe dedupe, or provider request idempotency option.
  const paymentIntent = await stripe.paymentIntents.create({
    amount: SERVER_OWNED_BOOKING_PRICE_CENTS,
    currency: SERVER_OWNED_CURRENCY,
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      source: "qedix-payment-idempotency-test",
      bookingId,
      userId: String(session.user.id),
    },
  });

  return res.status(200).json({
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
  });
}
