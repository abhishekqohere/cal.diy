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
  const bookingId = Number(req.body.bookingId);
  const title = String(req.body.title ?? "qedix-cross-tenant-mutation-risk");

  // BUG: cross-tenant mutation risk.
  // The request carries a tenantId, but the mutation uses only request-controlled
  // bookingId. It does not verify tenant membership and does not scope the where
  // clause by tenantId, organizationId, workspaceId, teamId, userId, ownership,
  // membership, or any trusted tenant boundary.
  // A user from one tenant can mutate another tenant's booking if they know the id.
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
    tenantId,
    booking,
  });
}
