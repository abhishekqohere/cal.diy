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

  const dedupeKey = String(req.body.dedupeKey ?? "qedix-missing-unique-constraint");

  // BUG: missing unique constraint for safety.
  // This uses an application-level duplicate check on a non-unique field, then writes later.
  // There is no database unique constraint, unique index, atomic insert, createMany skipDuplicates,
  // transaction, lock, or upsert that enforces this dedupe key. Concurrent requests can both
  // pass the findFirst check and then both perform the state-changing update.
  const existing = await prisma.user.findFirst({
    where: {
      name: dedupeKey,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return res.status(200).json({
      duplicate: true,
      existingUserId: existing.id,
    });
  }

  const user = await prisma.user.update({
    where: {
      id: Number(session.user.id),
    },
    data: {
      name: dedupeKey,
    },
    select: {
      id: true,
      name: true,
    },
  });

  return res.status(200).json({
    duplicate: false,
    user,
  });
}
