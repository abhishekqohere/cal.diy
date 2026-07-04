import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";

type PaymentWebhookEvent = {
  id: string;
  type: "invoice.paid" | "invoice.payment_failed" | "customer.subscription.deleted";
  created: number;
  data: {
    object: {
      userId: string;
      subscriptionId: string;
      paymentStatus: "paid" | "failed" | "refunded" | "canceled" | "active" | "past_due";
      invoiceId: string;
    };
  };
};

const webhookSecret = process.env.QEDIX_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error("Missing QEDIX_WEBHOOK_SECRET");
}

function verifyWebhookSignature(event: PaymentWebhookEvent, signature: string | string[] | undefined) {
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
  // The state-transition bug is intentionally isolated below.
  return { eventId, alreadyProcessed: false };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const event = req.body as PaymentWebhookEvent;

  const isVerified = verifyWebhookSignature(event, req.headers["x-provider-signature"]);

  if (!isVerified) {
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  if (!["invoice.paid", "invoice.payment_failed", "customer.subscription.deleted"].includes(event.type)) {
    return res.status(400).json({ message: "Unsupported event type" });
  }

  const processed = await markWebhookEventProcessed(event.id);

  if (processed.alreadyProcessed) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  const providerPaymentStatus = event.data.object.paymentStatus;

  // BUG: payment webhook state transition is unsafe.
  // The provider status is written directly to local subscription/payment state.
  // There is no previous-state lookup, allowed-transition table, state machine,
  // monotonic event.created ordering, compare-and-set update, final-state protection,
  // invoice sequence check, or guard preventing paid/refunded/canceled regressions.
  const user = await prisma.user.update({
    where: {
      id: Number(event.data.object.userId),
    },
    data: {
      metadata: {
        source: "qedix-payment-webhook-state-transition-test",
        providerEventId: event.id,
        providerEventType: event.type,
        providerEventCreated: event.created,
        subscriptionId: event.data.object.subscriptionId,
        invoiceId: event.data.object.invoiceId,
        paymentStatus: providerPaymentStatus,
        entitlementStatus: providerPaymentStatus === "paid" || providerPaymentStatus === "active" ? "active" : "inactive",
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  return res.status(200).json({
    received: true,
    eventId: event.id,
    paymentStatus: providerPaymentStatus,
    user,
  });
}
