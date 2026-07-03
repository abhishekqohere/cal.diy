import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";
import prisma from "@calcom/prisma";

type PaymentState = "pending" | "paid" | "active" | "past_due" | "canceled" | "refunded";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const subscriptionId = String(req.body.subscriptionId);
  const nextState = String(req.body.nextState) as PaymentState;
  const providerEventId = String(req.body.providerEventId);

  // BUG: payment/subscription state transition is trusted from request input.
  // There is no previous-state lookup, allowed transition table, monotonic state machine,
  // provider event ordering check, webhook signature verification, or idempotent event processing.
  const user = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      metadata: {
        source: "qedix-payment-state-transition-test",
        subscriptionId,
        paymentState: nextState,
        providerEventId,
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  return res.status(200).json({ user });
}
