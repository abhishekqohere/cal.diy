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

  const targetUserId = String(req.body.userId ?? "");
  const displayName = String(req.body.displayName ?? "qedix-raw-sql-risk");

  // BUG: raw SQL risk.
  // Request-controlled values are interpolated directly into an unsafe raw SQL mutation.
  // This is not parameterized and is not scoped by session.user.id, tenantId,
  // organizationId, workspaceId, ownership, membership, or any safe resource boundary.
  const sql = `
    UPDATE "users"
    SET "name" = '${displayName}'
    WHERE "id" = ${targetUserId}
  `;

  const result = await prisma.$executeRawUnsafe(sql);

  return res.status(200).json({
    changed: result,
  });
}
