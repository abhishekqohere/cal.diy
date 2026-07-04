import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";

type ProviderWebhookEvent = {
  id: string;
  type: "subscription.updated";
  created: number;
  data: {
    object: unknown;
  };
};

type SubscriptionWebhookPayload = {
  userId: string;
  subscriptionId: string;
  status: string;
  plan: string;
  seats: number;
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
  // The payload-trust bug is intentionally isolated below.
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

  if (event.type !== "subscription.updated") {
    return res.status(400).json({ message: "Unsupported event type" });
  }

  const processed = await markWebhookEventProcessed(event.id);

  if (processed.alreadyProcessed) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  // BUG: webhook payload is trusted directly.
  // event.data.object is unknown provider-controlled data, but it is cast to a trusted
  // subscription payload without checking required fields, field types, allowed status values,
  // plan allowlist, seat limits, nested shape, or unknown keys before database mutation.
  const payload = event.data.object as SubscriptionWebhookPayload;

  const user = await prisma.user.update({
    where: {
      id: Number(payload.userId),
    },
    data: {
      metadata: {
        source: "qedix-webhook-payload-trusted-directly-test",
        providerEventId: event.id,
        providerEventType: event.type,
        subscriptionId: payload.subscriptionId,
        subscriptionStatus: payload.status,
        plan: payload.plan,
        seats: payload.seats,
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  return res.status(200).json({ received: true, eventId: event.id, user });
}
