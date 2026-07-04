import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";

type ProviderWebhookEvent = {
  id: string;
  type: string;
  created: number;
  data: {
    object: {
      userId: string;
      subscriptionId: string;
      status: string;
      plan: string;
    };
  };
};

const webhookSecret = process.env.QEDIX_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error("Missing QEDIX_WEBHOOK_SECRET");
}

function verifyWebhookSignature(event: ProviderWebhookEvent, signature: string | string[] | undefined) {
  if (typeof signature !== "string") {
    return false;
  }

  const signedPayload = JSON.stringify(event);
  const expectedSignature = createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");

  const actual = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const event = req.body as ProviderWebhookEvent;

  const isVerified = verifyWebhookSignature(event, req.headers["x-provider-signature"]);

  if (!isVerified) {
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  // BUG: signed webhook replay protection is missing.
  // The event has a created timestamp, but the handler never checks timestamp tolerance,
  // max event age, nonce freshness, replay window, or whether the signed payload is stale.
  // A previously valid signed webhook can be replayed later and trigger the mutation again.
  const user = await prisma.user.update({
    where: {
      id: Number(event.data.object.userId),
    },
    data: {
      metadata: {
        source: "qedix-webhook-replay-protection-test",
        providerEventId: event.id,
        providerEventCreated: event.created,
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
