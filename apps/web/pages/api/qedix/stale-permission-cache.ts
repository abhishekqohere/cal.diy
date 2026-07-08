import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { prisma } from "@calcom/prisma";

const permissionDecisionCache = new Map<string, { role: string; canViewBilling: boolean }>();

const stalePermissionCacheSchema = z.object({
  teamId: z.coerce.number().int().positive(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const parsed = stalePermissionCacheSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const { teamId } = parsed.data;
  const permissionCacheSlot = `${session.user.id}:${teamId}:billing-permission`;

  // BUG: authorization decision is reused from cache without TTL, expiry, membership version,
  // role updatedAt check, permission version, revocation check, or invalidation after role changes.
  const cachedPermissionDecision = permissionDecisionCache.get(permissionCacheSlot);

  if (cachedPermissionDecision?.canViewBilling) {
    const billingSettings = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
        name: true,
        metadata: true,
      },
    });

    return res.status(200).json({
      source: "qedix-area-24-stale-permission-cache-test",
      fromCache: true,
      cachedRole: cachedPermissionDecision.role,
      billingSettings,
    });
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: Number(session.user.id),
      teamId,
    },
    select: {
      id: true,
      role: true,
      teamId: true,
      userId: true,
      updatedAt: true,
    },
  });

  if (!membership) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const canViewBilling = membership.role === "ADMIN" || membership.role === "OWNER";

  // BUG: permission decision is cached forever.
  // If this user is later removed from the team or downgraded from ADMIN to MEMBER,
  // the cached canViewBilling=true decision can keep granting access.
  // There is no TTL, no invalidation, no membership.updatedAt/version comparison,
  // and no fresh authorization check before returning billing settings.
  permissionDecisionCache.set(permissionCacheSlot, {
    role: membership.role,
    canViewBilling,
  });

  if (!canViewBilling) {
    return res.status(403).json({ message: "Requires billing admin permission" });
  }

  const billingSettings = await prisma.team.findUnique({
    where: {
      id: teamId,
    },
    select: {
      id: true,
      name: true,
      metadata: true,
    },
  });

  return res.status(200).json({
    source: "qedix-area-24-stale-permission-cache-test",
    fromCache: false,
    cachedRole: membership.role,
    membershipUpdatedAt: membership.updatedAt,
    billingSettings,
  });
}
