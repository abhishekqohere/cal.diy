import { createHmac, timingSafeEqual } from "node:crypto";

import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";

type BillingWebhookPayload = {
  userId: string;
  subscriptionStatus: string;
  entitlement: Record<string, unknown>;
};

function verifyWebhookSignature(payload: unknown, signature: string | string[] | undefined) {
  const secret = process.env.QEDIX_WEBHOOK_SECRET;

  if (!secret || typeof signature !== "string") {
    return false;
  }

  const expected = createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const payload = req.body as BillingWebhookPayload;

  // BUG: webhook payload is trusted before signature verification.
  // Request-controlled userId/status/entitlement are used in a DB mutation first.
  const user = await prisma.user.update({
    where: {
      id: Number(payload.userId),
    },
    data: {
      metadata: {
        source: "qedix-unverified-webhook-test",
        subscriptionStatus: payload.subscriptionStatus,
        entitlement: payload.entitlement,
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  const signature = req.headers["x-qedix-signature"];

  if (!verifyWebhookSignature(payload, signature)) {
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  return res.status(200).json({ user });
}
