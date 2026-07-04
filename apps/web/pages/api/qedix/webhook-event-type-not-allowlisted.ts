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
      subscriptionId?: string;
      invoiceId?: string;
      status?: string;
      plan?: string;
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

async function markWebhookEventProcessed(eventId: string) {
  // Controlled canary helper: pretend this records processed event ids.
  // The event type bug is intentionally isolated below.
  return { eventId, alreadyProcessed: false };
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

  const processed = await markWebhookEventProcessed(event.id);

  if (processed.alreadyProcessed) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  // BUG: webhook event type is not allowlisted.
  // The handler never checks event.type against a fixed allowlist before applying side effects.
  // Any provider event type can reach this mutation, including unrelated, test, deleted,
  // disputed, failed, pending, or unknown future event types.
  const user = await prisma.user.update({
    where: {
      id: Number(event.data.object.userId),
    },
    data: {
      metadata: {
        source: "qedix-webhook-event-type-not-allowlisted-test",
        providerEventId: event.id,
        providerEventType: event.type,
        providerEventCreated: event.created,
        subscriptionId: event.data.object.subscriptionId ?? "",
        invoiceId: event.data.object.invoiceId ?? "",
        subscriptionStatus: event.data.object.status ?? "unknown",
        plan: event.data.object.plan ?? "unknown",
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  return res.status(200).json({ received: true, eventType: event.type, user });
}
