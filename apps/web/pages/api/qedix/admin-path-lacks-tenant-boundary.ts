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

  const adminEmail = String(session.user.email ?? "");

  if (!adminEmail.endsWith("@qedix-admin.test")) {
    return res.status(403).json({ message: "Admin access required" });
  }

  const tenantId = String(req.body.tenantId ?? "");
  const organizationId = String(req.body.organizationId ?? "");
  const bookingId = Number(req.body.bookingId);
  const title = String(req.body.title ?? "qedix-admin-path-lacks-tenant-boundary");

  // BUG: admin path lacks tenant boundary.
  // This privileged admin mutation receives tenantId/organizationId, but the database
  // update uses only request-controlled bookingId. It does not verify that the admin
  // is scoped to the tenant/organization/workspace that owns the booking.
  // A global or mis-scoped admin path can mutate another tenant's resource if the id is known.
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
    organizationId,
    booking,
  });
}
