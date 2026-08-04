import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { prisma } from "@calcom/prisma";

const sharedViewerProfileCache = new Map<string, unknown>();
const sharedViewerProfileSlot = "viewer-profile";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // BUG: cached user response is shared across all authenticated users.
  // The cache key does not include session.user.id, organizationId, tenantId,
  // workspaceId, Authorization, Cookie, or any other viewer-specific identity.
  const cachedViewerProfile = sharedViewerProfileCache.get(sharedViewerProfileSlot);

  if (cachedViewerProfile) {
    // BUG: authenticated private response is marked public and CDN-cacheable.
    // Correct behavior should be Cache-Control: private, no-store.
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("CDN-Cache-Control", "public, max-age=86400");
    res.setHeader("Vercel-CDN-Cache-Control", "public, max-age=86400");

    return res.status(200).json(cachedViewerProfile);
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

  const privateViewerResponse = {
    source: "qedix-area-24-private-response-cached-publicly-test",
    viewerId: session.user.id,
    email: user?.email,
    role: user?.role,
    organizationId: user?.organizationId,
    metadata: user?.metadata,
    twoFactorEnabled: user?.twoFactorEnabled,
    twoFactorSecret: user?.twoFactorSecret,
    backupCodes: user?.backupCodes,
    passwordHash: user?.password?.hash,
  };

  // BUG: private authenticated user data is written to a shared process cache.
  // Another authenticated user can receive this cached response because the key is global.
  sharedViewerProfileCache.set(sharedViewerProfileSlot, privateViewerResponse);

  // BUG: private response cached publicly.
  // This combines authenticated user data with public CDN/shared-cache headers.
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
  res.setHeader("CDN-Cache-Control", "public, max-age=86400");
  res.setHeader("Vercel-CDN-Cache-Control", "public, max-age=86400");

  return res.status(200).json(privateViewerResponse);
}
