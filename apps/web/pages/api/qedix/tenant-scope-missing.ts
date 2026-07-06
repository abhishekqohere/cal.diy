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
  const title = String(req.body.title ?? "qedix-tenant-scope-missing");

  // BUG: tenant scope missing.
  // The request carries a tenantId, but the database mutation does not include
  // tenantId, organizationId, workspaceId, teamId, membership, or tenant boundary
  // evidence in the where clause. The booking is selected only by request-controlled id.
  // In a multi-tenant app, this can allow a user from one tenant to mutate another
  // tenant's booking if they know or guess the booking id.
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
