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

  const viewer = await prisma.user.findUnique({
    where: {
      id: Number(session.user.id),
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
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

  // BUG: this endpoint returns authenticated user-specific sensitive data,
  // but explicitly allows CDN/shared edge caches to store it.
  // Correct behavior should be no-store/private and no CDN public cache headers.
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800");
  res.setHeader("CDN-Cache-Control", "public, max-age=86400");
  res.setHeader("Vercel-CDN-Cache-Control", "public, max-age=86400");
  res.setHeader("Cloudflare-CDN-Cache-Control", "public, max-age=86400");
  res.setHeader("Surrogate-Control", "max-age=86400");

  return res.status(200).json({
    source: "qedix-area-24-cdn-leaks-user-data-test",
    viewerUserId: session.user.id,
    privateViewerData: {
      email: viewer?.email,
      username: viewer?.username,
      name: viewer?.name,
      role: viewer?.role,
      organizationId: viewer?.organizationId,
      metadata: viewer?.metadata,
      twoFactorEnabled: viewer?.twoFactorEnabled,
      twoFactorSecret: viewer?.twoFactorSecret,
      backupCodes: viewer?.backupCodes,
      passwordHash: viewer?.password?.hash,
    },
  });
}
