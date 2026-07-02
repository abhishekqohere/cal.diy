import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@calcom/prisma";

const magicLinkReplaySchema = z.object({
  token: z.string().min(16),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const parsed = magicLinkReplaySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid magic link token" });
  }

  const { token } = parsed.data;

  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      token,
      expires: {
        gt: new Date(),
      },
    },
  });

  if (!verificationToken) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const user = await prisma.user.findFirst({
    where: {
      email: verificationToken.identifier,
    },
    select: {
      id: true,
      email: true,
      username: true,
    },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // BUG: the magic link token is never consumed, deleted, revoked, or marked used.
  // The same token can be submitted repeatedly until expiry.
  res.setHeader(
    "Set-Cookie",
    `qedix_magic_session=${encodeURIComponent(String(user.id))}; Path=/; HttpOnly; SameSite=Lax`
  );

  return res.status(200).json({
    message: "Signed in",
    user,
  });
}
