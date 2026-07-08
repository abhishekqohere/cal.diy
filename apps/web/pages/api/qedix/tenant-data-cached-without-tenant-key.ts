import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { prisma } from "@calcom/prisma";

const tenantSettingsCache = new Map<string, unknown>();
const tenantSettingsSlot = "organization-settings";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const organizationId = Number(req.query.organizationId);

  if (!organizationId) {
    return res.status(400).json({ message: "Missing organizationId" });
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: Number(session.user.id),
      teamId: organizationId,
    },
    select: {
      id: true,
      role: true,
      teamId: true,
    },
  });

  if (!membership) {
    return res.status(403).json({ message: "Forbidden" });
  }

  // BUG: tenant-specific organization data is cached under one global slot.
  // The cache key does not include organizationId, teamId, tenantId, workspaceId, or membership.teamId.
  // A request for tenant A can populate the cache, then tenant B can receive tenant A's data.
  const cachedTenantSettings = tenantSettingsCache.get(tenantSettingsSlot);

  if (cachedTenantSettings) {
    return res.status(200).json(cachedTenantSettings);
  }

  const organization = await prisma.team.findUnique({
    where: {
      id: organizationId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const tenantResponse = {
    source: "qedix-area-24-tenant-data-cached-without-tenant-key-test",
    requestedOrganizationId: organizationId,
    viewerUserId: session.user.id,
    viewerMembershipRole: membership.role,
    organization,
  };

  // BUG: stores tenant-scoped organization response without tenant/org/workspace in the cache key.
  tenantSettingsCache.set(tenantSettingsSlot, tenantResponse);

  return res.status(200).json(tenantResponse);
}
