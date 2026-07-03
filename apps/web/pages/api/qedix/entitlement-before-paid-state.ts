import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";
import prisma from "@calcom/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const checkoutSessionId = String(req.body.checkoutSessionId);
  const subscriptionId = String(req.body.subscriptionId);
  const requestedPlan = String(req.body.plan ?? "team");

  // BUG: entitlement is granted before verified paid/active provider state.
  // There is no Stripe checkout.sessions.retrieve, payment_status === "paid",
  // subscription.status active/trialing check, invoice paid check,
  // webhook signature verification, or idempotent provider-event processing.
  const user = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      metadata: {
        source: "qedix-entitlement-before-paid-state-test",
        plan: requestedPlan,
        entitlement: "active",
        checkoutSessionId,
        subscriptionId,
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  return res.status(200).json({ user });
}
