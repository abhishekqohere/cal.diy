import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@calcom/prisma";

const refreshTokenMisuseSchema = z.object({
  refreshToken: z.string().min(16),
  deviceId: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const parsed = refreshTokenMisuseSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid refresh request" });
  }

  const { refreshToken, deviceId } = parsed.data;

  const storedRefreshToken = await prisma.verificationToken.findFirst({
    where: {
      token: refreshToken,
    },
  });

  if (!storedRefreshToken) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const user = await prisma.user.findFirst({
    where: {
      email: storedRefreshToken.identifier,
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

  // BUG: refresh token expiry is never checked.
  // BUG: refresh token is never rotated, revoked, deleted, or marked used.
  // BUG: deviceId is accepted from the request but not bound to the stored token.
  const newAccessToken = Buffer.from(`${user.id}:${Date.now()}:${deviceId ?? "unknown-device"}`).toString("base64");

  return res.status(200).json({
    accessToken: newAccessToken,
    refreshToken,
    user,
  });
}
