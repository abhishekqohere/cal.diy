import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { prisma } from "@calcom/prisma";

const publicPrivateProfileCache = new Map<string, unknown>();
const SHARED_PUBLIC_CACHE_KEY = "qedix-viewer-private-profile";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // BUG: auth-specific private data is cached under one shared key.
  // The cache key does not include session.user.id, tenantId, organizationId, cookie, or Authorization state.
  const cachedPrivateProfile = publicPrivateProfileCache.get(SHARED_PUBLIC_CACHE_KEY);

  if (cachedPrivateProfile) {
    // BUG: cached private response is served with public/shared cache headers.
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("CDN-Cache-Control", "public, max-age=86400");
    res.setHeader("Vercel-CDN-Cache-Control", "public, max-age=86400");
    res.setHeader("Surrogate-Control", "max-age=86400");

    return res.status(200).json(cachedPrivateProfile);
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

  const privateResponseBody = {
    source: "qedix-area-24-private-response-cached-publicly-test",
    viewerId: session.user.id,
    privateUserProfile: user,
  };

  // BUG: private authenticated user response is stored in a shared public cache.
  // This can leak one user's profile to another user through server cache, CDN cache, or shared proxy cache.
  publicPrivateProfileCache.set(SHARED_PUBLIC_CACHE_KEY, privateResponseBody);

  // BUG: private response cached publicly.
  // Auth-specific data should use no-store/private, but this marks it public and CDN-cacheable.
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
  res.setHeader("CDN-Cache-Control", "public, max-age=86400");
  res.setHeader("Vercel-CDN-Cache-Control", "public, max-age=86400");
  res.setHeader("Surrogate-Control", "max-age=86400");

  return res.status(200).json(privateResponseBody);
}
