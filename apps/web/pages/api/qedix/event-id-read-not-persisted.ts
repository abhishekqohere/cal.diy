import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";

type ProviderWebhookEvent = {
  id: string;
  type: "invoice.paid" | "subscription.updated";
  created: number;
  data: {
    object: {
      userId: string;
      subscriptionId: string;
      status: string;
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

  if (!["invoice.paid", "subscription.updated"].includes(event.type)) {
    return res.status(400).json({ message: "Unsupported event type" });
  }

  const providerEventId = event.id;

  // BUG: event.id is read but not persisted or checked as a durable dedupe guard.
  // The handler reads providerEventId, but there is no processed-event lookup by event.id,
  // no insert into a processed webhook event table, no unique constraint on event.id,
  // no transaction that records event.id before the side effect, and no already-processed branch.
  // Storing event.id in user metadata after the mutation is not a safe dedupe check.
  const user = await prisma.user.update({
    where: {
      id: Number(event.data.object.userId),
    },
    data: {
      metadata: {
        source: "qedix-event-id-read-not-persisted-test",
        lastSeenProviderEventId: providerEventId,
        subscriptionId: event.data.object.subscriptionId,
        subscriptionStatus: event.data.object.status,
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  return res.status(200).json({
    received: true,
    eventId: providerEventId,
    user,
  });
}
