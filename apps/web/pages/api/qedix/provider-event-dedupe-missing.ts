import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";

type ProviderWebhookEvent = {
  id: string;
  type: "subscription.updated" | "subscription.deleted" | "invoice.paid";
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

  if (!["subscription.updated", "subscription.deleted", "invoice.paid"].includes(event.type)) {
    return res.status(400).json({ message: "Unsupported event type" });
  }

  // BUG: provider event dedupe is missing.
  // event.id is available, but there is no processedWebhookEvent lookup,
  // no persisted provider-event table, no unique constraint, no upsert guard,
  // no transaction around "mark processed + apply side effect", and no already-processed check.
  // Provider retries can process the same event.id repeatedly.
  const user = await prisma.user.update({
    where: {
      id: Number(event.data.object.userId),
    },
    data: {
      metadata: {
        source: "qedix-provider-event-dedupe-test",
        lastProviderEventId: event.id,
        lastProviderEventCreated: event.created,
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

  return res.status(200).json({ received: true, eventId: event.id, user });
}
