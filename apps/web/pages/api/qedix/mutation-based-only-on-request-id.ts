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

  const targetUserId = Number(req.body.userId);
  const displayName = String(req.body.displayName ?? "qedix-request-id-only");

  // BUG: mutation is based only on a request-controlled id.
  // The authenticated user is checked, but session.user.id is not used to scope
  // the mutation. Any authenticated user can submit another user's id and update
  // that user's record because the where clause relies only on req.body.userId.
  const user = await prisma.user.update({
    where: {
      id: targetUserId,
    },
    data: {
      name: displayName,
    },
    select: {
      id: true,
      name: true,
    },
  });

  return res.status(200).json({
    user,
  });
}
