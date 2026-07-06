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

  const organizationId = String(req.body.organizationId ?? "");
  const bookingId = Number(req.body.bookingId);
  const title = String(req.body.title ?? "qedix-organization-filter-missing");

  // BUG: organization filter missing.
  // The request carries an organizationId, but the database mutation does not include
  // organizationId, tenantId, workspaceId, teamId, membership, ownership,
  // or any organization boundary evidence in the where clause.
  // The booking is selected only by request-controlled id, so a user from one
  // organization can mutate another organization's booking if they know the id.
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
    organizationId,
    booking,
  });
}
