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

  const displayName = req.body.displayName;
  const timeZone = req.body.timeZone;
  const weekStart = req.body.weekStart;

  const user = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      name: displayName,
      timeZone,
      weekStart,
    },
    select: {
      id: true,
      name: true,
      timeZone: true,
      weekStart: true,
    },
  });

  return res.status(200).json({ user });
}
