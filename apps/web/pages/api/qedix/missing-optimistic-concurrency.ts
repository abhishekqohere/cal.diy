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

  const bookingId = Number(req.body.bookingId);
  const title = String(req.body.title ?? "qedix-missing-optimistic-concurrency");

  // BUG: missing optimistic concurrency.
  // The handler reads the booking first, then updates it later using only id.
  // It does not compare updatedAt, version, revision, status, or any previous-state
  // value in the update where clause. A concurrent request can update the same booking
  // between the read and the write, and this request can overwrite the newer state.
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
    },
  });

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const updatedBooking = await prisma.booking.update({
    where: {
      id: booking.id,
    },
    data: {
      title,
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
    },
  });

  return res.status(200).json({
    previousUpdatedAt: booking.updatedAt,
    booking: updatedBooking,
  });
}
