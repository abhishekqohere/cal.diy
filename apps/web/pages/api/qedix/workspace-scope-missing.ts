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

  const workspaceId = String(req.body.workspaceId ?? "");
  const bookingId = Number(req.body.bookingId);
  const title = String(req.body.title ?? "qedix-workspace-scope-missing");

  // BUG: workspace scope missing.
  // The request carries a workspaceId, but the database mutation does not include
  // workspaceId, tenantId, organizationId, teamId, membership, ownership,
  // or any workspace boundary evidence in the where clause.
  // The booking is selected only by request-controlled id, so a user from one
  // workspace can mutate another workspace's booking if they know the id.
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
    workspaceId,
    booking,
  });
}
