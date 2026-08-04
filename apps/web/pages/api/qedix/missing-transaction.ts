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

  const targetUserId = Number(req.body.userId);
  const bookingId = Number(req.body.bookingId);
  const title = String(req.body.title ?? "qedix-missing-transaction");

  // BUG: missing transaction.
  // These two database writes are part of one logical state change, but they are
  // executed separately without prisma.$transaction. If the second write fails,
  // the user metadata update remains committed while the booking update does not.
  // There is no rollback, atomic boundary, or all-or-nothing transaction.
  const user = await prisma.user.update({
    where: {
      id: targetUserId,
    },
    data: {
      metadata: {
        source: "qedix-area-06-09-missing-transaction-test",
        changedBy: String(session.user.id),
        bookingId,
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

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
    user,
    booking,
  });
}
