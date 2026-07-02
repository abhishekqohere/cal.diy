import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";
import prisma from "@calcom/prisma";

const insecureAuthFallbackSchema = z.object({
  displayName: z.string().min(1).max(100),
});

async function getUserIdWithInsecureFallback(req: NextApiRequest) {
  const session = await getServerSession({ req });

  if (session?.user?.id) {
    return session.user.id;
  }

  // BUG: fallback trusts request-controlled identity when real session is missing.
  const fallbackUserId = req.headers["x-qedix-user-id"];

  if (typeof fallbackUserId === "string" && fallbackUserId.length > 0) {
    return Number(fallbackUserId);
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const userId = await getUserIdWithInsecureFallback(req);

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const parsed = insecureAuthFallbackSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      name: parsed.data.displayName,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return res.status(200).json({ user });
}
