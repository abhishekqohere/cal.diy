import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@calcom/prisma";

const sessionCheckMissingSchema = z.object({
  userId: z.coerce.number().int().positive(),
  timeZone: z.string().min(1).max(100),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const sessionToken =
    req.cookies["next-auth.session-token"] ??
    req.cookies["__Secure-next-auth.session-token"];

  if (!sessionToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const parsed = sessionCheckMissingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const { userId, timeZone } = parsed.data;

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      timeZone,
    },
    select: {
      id: true,
      username: true,
      timeZone: true,
    },
  });

  return res.status(200).json({ user });
}
