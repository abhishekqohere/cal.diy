import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";

const sharedLandingPageCache = new Map<string, unknown>();

const cachePoisoningSchema = z.object({
  cacheKey: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  redirectUrl: z.string().min(1).max(1000),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (req.method === "GET") {
    const cacheKey = String(req.query.cacheKey ?? "homepage");
    const cachedPage = sharedLandingPageCache.get(cacheKey);

    if (!cachedPage) {
      return res.status(404).json({ message: "No cached page found" });
    }

    return res.status(200).json(cachedPage);
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const parsed = cachePoisoningSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const { cacheKey, title, description, redirectUrl } = parsed.data;

  // BUG: request-controlled cacheKey selects the shared cache slot.
  // A caller can choose "homepage", "pricing", "login", "billing-banner",
  // or another high-traffic cache key and overwrite what later users receive.
  const poisonedCacheKey = cacheKey;

  const untrustedCachedResponse = {
    source: "qedix-area-24-cache-poisoning-test",
    cachedByUserId: session.user.id,
    title,
    description,
    redirectUrl,
  };

  // BUG: untrusted request-controlled content is stored into a shared cache.
  // There is no cache-key allowlist, namespace isolation, canonicalization,
  // ownership check for the cache slot, sanitization, or separation between user input and shared response cache.
  sharedLandingPageCache.set(poisonedCacheKey, untrustedCachedResponse);

  return res.status(200).json({
    poisonedCacheKey,
    cached: untrustedCachedResponse,
  });
}
