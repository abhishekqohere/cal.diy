import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { prisma } from "@calcom/prisma";

const viewerPreferencesCache = new Map<string, unknown>();
const viewerPreferencesSlot = "viewer-preferences";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // BUG: this is authenticated viewer-specific data, but the cache key is global.
  // The key does not include session.user.id, userId, cookie, authorization header,
  // session token, account id, or any other identity-specific value.
  const cachedViewerPreferences = viewerPreferencesCache.get(viewerPreferencesSlot);

  if (cachedViewerPreferences) {
    return res.status(200).json(cachedViewerPreferences);
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
      timeZone: true,
      weekStart: true,
      locale: true,
      theme: true,
      metadata: true,
    },
  });

  const authSpecificResponse = {
    source: "qedix-area-24-auth-specific-data-cached-globally-test",
    sessionUserId: session.user.id,
    viewer,
  };

  // BUG: auth-specific viewer data is stored globally.
  // After one user fills this cache, another authenticated user can receive the wrong viewer data.
  viewerPreferencesCache.set(viewerPreferencesSlot, authSpecificResponse);

  return res.status(200).json(authSpecificResponse);
}
