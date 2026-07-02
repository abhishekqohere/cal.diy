import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@calcom/prisma";

const cookieSessionMisuseSchema = z.object({
  userId: z.coerce.number().int().positive(),
  displayName: z.string().min(1).max(100),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const parsed = cookieSessionMisuseSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const { userId, displayName } = parsed.data;

  res.setHeader(
    "Set-Cookie",
    `qedix_session_user_id=${encodeURIComponent(String(userId))}; Path=/; Max-Age=2592000; SameSite=None`
  );

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      name: displayName,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return res.status(200).json({
    message: "Session cookie created",
    user,
  });
}
