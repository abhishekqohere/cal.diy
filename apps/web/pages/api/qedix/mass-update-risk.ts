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

  const emailDomain = String(req.body.emailDomain ?? "example.com");
  const note = String(req.body.note ?? "qedix-mass-update-risk");

  // BUG: mass update risk.
  // This updateMany call has a broad request-controlled filter.
  // A user can choose a domain-like value and update many user records at once.
  // The mutation is not scoped by session.user.id, tenantId, organizationId,
  // workspaceId, ownership, membership, or a safe resource boundary.
  const result = await prisma.user.updateMany({
    where: {
      email: {
        contains: emailDomain,
      },
    },
    data: {
      metadata: {
        source: "qedix-area-06-03-mass-update-risk-test",
        changedBy: String(session.user.id),
        emailDomain,
        note,
      },
    },
  });

  return res.status(200).json({
    updatedCount: result.count,
  });
}
