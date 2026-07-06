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

  const userId = Number(req.body.userId);
  const suffix = String(req.body.suffix ?? "qedix-rmw");

  // BUG: read-modify-write race.
  // This reads the current user, computes new state in application code,
  // then writes it back without a transaction, lock, optimistic version check,
  // compare-and-set where clause, or atomic database update.
  // Concurrent requests can read the same old value and overwrite each other.
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const nextName = `${user.name ?? "user"}-${suffix}`;

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      name: nextName,
    },
    select: {
      id: true,
      name: true,
    },
  });

  return res.status(200).json({
    user: updatedUser,
  });
}
