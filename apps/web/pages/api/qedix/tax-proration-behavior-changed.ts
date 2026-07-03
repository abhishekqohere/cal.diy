import Stripe from "stripe";
import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";

const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY;

if (!stripePrivateKey) {
  throw new Error("Missing STRIPE_PRIVATE_KEY");
}

const stripe = new Stripe(stripePrivateKey);

const SERVER_OWNED_TEAM_PLAN_PRICE_ID = "price_qedix_server_owned_team_plan";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const subscriptionId = String(req.body.subscriptionId);
  const subscriptionItemId = String(req.body.subscriptionItemId);

  // BUG: tax and proration behavior are changed without safety evidence.
  // There is no invoice preview, customer jurisdiction check, tax policy validation,
  // migration plan, rollout guard, finance approval, or test coverage for proration/tax impact.
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscriptionItemId,
        price: SERVER_OWNED_TEAM_PLAN_PRICE_ID,
      },
    ],
    proration_behavior: "none",
    automatic_tax: {
      enabled: false,
    },
    default_tax_rates: [],
    metadata: {
      source: "qedix-tax-proration-behavior-test",
      userId: String(session.user.id),
      changedBy: "qedix-canary",
    },
  });

  return res.status(200).json({
    subscriptionId: subscription.id,
    status: subscription.status,
  });
}
