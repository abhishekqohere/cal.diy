import type { NextApiRequest, NextApiResponse } from "next";
 
import { getServerSession } from "@calcom/features/auth/lib/next-auth";
import prisma from "@calcom/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req }); 

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const tenantId = String(req.body.tenantId ?? "");
  const organizationId = String(req.body.organizationId ?? "");
  const stripeSubscriptionId = String(req.body.stripeSubscriptionId ?? "");
  const status = String(req.body.status ?? "active");

  // BUG: billing object not linked to tenant.
  // The request carries tenantId/organizationId, but the billing mutation selects
  // the subscription only by a request-controlled external billing id.
  // It does not verify that the Stripe subscription/customer belongs to the tenant,
  // organization, workspace, team, owner, membership, or trusted session tenant identity.
  // A user from one tenant can update another tenant's billing object if they know the id.
  const subscription = await (prisma as any).subscription.update({
    where: {
      stripeSubscriptionId,
    },
    data: {
      status,
      metadata: {
        source: "qedix-area-07-09-billing-object-not-linked-to-tenant",
        changedBy: String(session.user.id),
        requestedTenantId: tenantId,
        requestedOrganizationId: organizationId,
      },
    },
    select: {
      id: true,
      stripeSubscriptionId: true,
      status: true,
      metadata: true,
    },
  });

  return res.status(200).json({
    tenantId,
    organizationId,
    subscription,
  });
}
