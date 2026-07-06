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

  const bookingId = Number(req.body.bookingId);
  const title = String(req.body.title ?? "qedix-missing-scope");

  // BUG: missing tenant/user/org filter.
  // This mutation uses only a request-controlled booking id.
  // It does not include session.user.id, tenantId, organizationId, workspaceId,
  // teamId, membership, ownership, or any safe resource boundary in the where clause.
  const booking = await prisma.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      title,
    },
    select: {
      id: true,
      title: true,
    },
  });

  return res.status(200).json({
    booking,
  });
}
