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

  // BUG: unscoped database delete.
  // This deleteMany call has no where clause at all.
  // A single authenticated request can delete many user records because the mutation
  // is not scoped by session.user.id, tenantId, organizationId, workspaceId,
  // or any safe resource boundary.
  const result = await prisma.user.deleteMany({});

  return res.status(200).json({
    deletedCount: result.count,
  });
}
