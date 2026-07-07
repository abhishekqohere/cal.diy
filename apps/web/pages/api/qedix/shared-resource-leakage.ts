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
  const workspaceId = String(req.query.workspaceId ?? "");
  const sharedResourceKey = String(req.query.sharedResourceKey ?? "");

  // BUG: shared resource leakage.
  // The request carries tenantId/workspaceId and a sharedResourceKey, but the read does not
  // verify tenant membership, workspace membership, organization membership, ownership,
  // or any trusted tenant boundary before returning shared booking data.
  // A user from one tenant/workspace can enumerate or read another tenant/workspace's
  // shared resource data if they know or guess the shared key/title.
  const bookings = await prisma.booking.findMany({
    where: {
      title: {
        contains: sharedResourceKey,
      },
    },
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
    },
    take: 20,
  });

  return res.status(200).json({
    tenantId,
    workspaceId,
    sharedResourceKey,
    bookings,
  });
}
