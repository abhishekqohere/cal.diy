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

  // BUG: arbitrary request-controlled JSON is trusted without schema validation,
  // allowed-key checks, depth limits, size limits, or sanitization.
  const trustedMetadata = req.body.metadata as Record<string, unknown>;

  const user = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      metadata: {
        source: "qedix-unknown-json-test",
        profile: trustedMetadata,
      },
    },
    select: {
      id: true,
      email: true,
      metadata: true,
    },
  });

  return res.status(200).json({ user });
}
