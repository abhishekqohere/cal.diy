import Stripe from "stripe";
import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";
import prisma from "@calcom/prisma";

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

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status !== "succeeded") {
    return res.status(402).json({ message: "Payment is not complete" });
  }

  // BUG: provider response is trusted without local order/payment reconciliation.
  // There is no local order lookup, expected amount/currency check, booking ownership check,
  // userId/tenantId/metadata match, price/plan reconciliation, or persisted payment record check.
  const user = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      metadata: {
        source: "qedix-provider-response-reconciliation-test",
        entitlement: "active",
        paymentIntentId,
        providerStatus: paymentIntent.status,
        providerAmount: paymentIntent.amount,
        providerCurrency: paymentIntent.currency,
        providerPlan: paymentIntent.metadata?.plan ?? "team",
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  return res.status(200).json({ user });
}
