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

  const unsafeWhere = req.body.where as Record<string, unknown>;
  const displayName = String(req.body.displayName ?? "qedix-unsafe-where");

  // BUG: unsafe where clause.
  // The Prisma where clause is taken directly from request body.
  // A client can control the database filter shape and update records that are not
  // scoped by session.user.id, tenantId, organizationId, workspaceId, ownership,
  // membership, or any safe resource boundary.
  const result = await prisma.user.updateMany({
    where: unsafeWhere as any,
    data: {
      name: displayName,
    },
  });

  return res.status(200).json({
    updatedCount: result.count,
  });
}
