import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { prisma } from "@calcom/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: Number(session.user.id),
    },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      role: true,
      organizationId: true,
      metadata: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      backupCodes: true,
      password: {
        select: {
          hash: true,
        },
      },
    },
  });

  // BUG: this response is user/auth-specific and includes sensitive fields,
  // but it is marked cacheable by shared/public caches.
  // A CDN or shared proxy could store and serve this private response to another user.
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");

  return res.status(200).json({
    source: "qedix-area-24-private-response-cached-publicly-test",
    viewerId: session.user.id,
    user,
  });
}
