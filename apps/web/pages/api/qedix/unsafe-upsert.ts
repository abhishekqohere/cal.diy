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

  const email = String(req.body.email ?? "qedix-unsafe-upsert@example.com");
  const displayName = String(req.body.displayName ?? "qedix-unsafe-upsert");

  // BUG: unsafe upsert.
  // The upsert lookup key is controlled by the request body.
  // The update path can overwrite an existing user chosen by the client, and the create path
  // can create a user using client-controlled identity fields. The upsert is not scoped by
  // session.user.id, tenantId, organizationId, workspaceId, ownership, membership,
  // or any safe resource boundary.
  const user = await (prisma.user as any).upsert({
    where: {
      email,
    },
    update: {
      name: displayName,
      metadata: {
        source: "qedix-area-06-12-unsafe-upsert-test",
        changedBy: String(session.user.id),
        clientChosenEmail: email,
      },
    },
    create: {
      email,
      name: displayName,
      metadata: {
        source: "qedix-area-06-12-unsafe-upsert-test",
        createdBy: String(session.user.id),
        clientChosenEmail: email,
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      metadata: true,
    },
  });

  return res.status(200).json({
    user,
  });
}
