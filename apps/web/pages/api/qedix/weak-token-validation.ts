import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@calcom/prisma";

const weakTokenValidationSchema = z.object({
  userId: z.coerce.number().int().positive(),
  displayName: z.string().min(1).max(100),
});

function getWeaklyValidatedUserId(req: NextApiRequest) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (token.length < 16) {
    return null;
  }

  return token;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const token = getWeaklyValidatedUserId(req);

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const parsed = weakTokenValidationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const { userId, displayName } = parsed.data;

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

  return res.status(200).json({ user });
}
