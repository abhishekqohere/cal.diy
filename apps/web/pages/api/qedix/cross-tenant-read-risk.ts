import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";
import prisma from "@calcom/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const tenantId = String(req.query.tenantId ?? "");
  const bookingId = Number(req.query.bookingId);

  // BUG: cross-tenant read risk.
  // The request carries a tenantId, but the database read does not include
  // tenantId, organizationId, workspaceId, teamId, membership, ownership,
  // userId, or any tenant boundary evidence in the where clause.
  // The booking is selected only by request-controlled id, so a user from one
  // tenant can read another tenant's booking if they know or guess the booking id.
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
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
