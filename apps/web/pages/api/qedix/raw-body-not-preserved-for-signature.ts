import { createHmac, timingSafeEqual } from "node:crypto";
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

const webhookSecret = process.env.QEDIX_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error("Missing QEDIX_WEBHOOK_SECRET");
}

function verifyWebhookSignatureFromParsedBody(event: ProviderWebhookEvent, signature: string | string[] | undefined) {
  if (typeof signature !== "string") {
    return false;
  }

  // BUG: signature verification uses a reconstructed parsed body instead of the exact raw body.
  // Next.js body parsing has already changed the original bytes, and this file does not export
  // config.api.bodyParser = false, does not read a raw buffer, and does not verify the provider
  // signature against the exact raw request payload.
  const reconstructedBody = JSON.stringify(event);
  const expectedSignature = createHmac("sha256", webhookSecret).update(reconstructedBody).digest("hex");

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

  const isVerified = verifyWebhookSignatureFromParsedBody(event, req.headers["x-provider-signature"]);

  if (!isVerified) {
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  const user = await prisma.user.update({
    where: {
      id: Number(event.data.object.userId),
    },
    data: {
      metadata: {
        source: "qedix-raw-body-not-preserved-test",
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
