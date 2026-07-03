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

  const checkoutSessionId = String(req.body.checkoutSessionId);

  const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["subscription"],
  });

  if (checkoutSession.payment_status !== "paid") {
    return res.status(402).json({ message: "Checkout session is not paid" });
  }

  const subscriptionId =
    typeof checkoutSession.subscription === "string"
      ? checkoutSession.subscription
      : checkoutSession.subscription?.id ?? "";

  // BUG: checkout ownership is not verified.
  // The code checks paid state, but never verifies checkoutSession.metadata.userId,
  // client_reference_id, bookingId, teamId, tenantId, or owner scope against session.user.id.
  const user = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      metadata: {
        source: "qedix-checkout-ownership-test",
        entitlement: "active",
        checkoutSessionId,
        subscriptionId,
        plan: checkoutSession.metadata?.plan ?? "team",
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  return res.status(200).json({ user });
}
