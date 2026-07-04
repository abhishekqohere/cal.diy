import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";

type ProviderWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: {
      userId: string;
      subscriptionId: string;
      status: string;
      plan: string;
    };
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const event = req.body as ProviderWebhookEvent;

  // BUG: provider webhook is trusted without signature verification.
  // There is no raw-body signature verification, no provider signature header check,
  // no timestamp tolerance check, and no timing-safe signature comparison.
  const user = await prisma.user.update({
    where: {
      id: Number(event.data.object.userId),
    },
    data: {
      metadata: {
        source: "qedix-webhook-signature-missing-test",
        providerEventId: event.id,
        providerEventType: event.type,
        subscriptionId: event.data.object.subscriptionId,
        subscriptionStatus: event.data.object.status,
        plan: event.data.object.plan,
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  return res.status(200).json({ received: true, user });
}
