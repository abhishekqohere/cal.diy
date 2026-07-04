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

  if (!["invoice.paid", "subscription.updated"].includes(event.type)) {
    return res.status(400).json({ message: "Unsupported event type" });
  }

  const providerEventId = event.id;

  // BUG: webhook side effect happens before event dedupe.
  // The provider signature is checked, but the handler updates user metadata before
  // checking whether providerEventId was already processed. This means retries can
  // apply the mutation before the duplicate-event branch runs.
  const user = await prisma.user.update({
    where: {
      id: Number(event.data.object.userId),
    },
    data: {
      metadata: {
        source: "qedix-side-effect-before-dedupe-test",
        lastProviderEventId: providerEventId,
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

  // BUG: this dedupe-style check is too late.
  // It runs after the side effect and does not use a durable processed-event table,
  // unique constraint, upsert guard, or transaction around mark-processed + mutation.
  const alreadyProcessed = String(user.metadata ?? "").includes(providerEventId);

  if (alreadyProcessed) {
    return res.status(200).json({
      received: true,
      duplicate: true,
      message: "Duplicate check ran after side effect",
    });
  }

  return res.status(200).json({ received: true, eventId: providerEventId, user });
}
