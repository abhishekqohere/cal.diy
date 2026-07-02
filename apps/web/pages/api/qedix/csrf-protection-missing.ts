import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";
import prisma from "@calcom/prisma";

const csrfProtectionMissingSchema = z.object({
  timeZone: z.string().min(1).max(100),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const parsed = csrfProtectionMissingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const { timeZone } = parsed.data;

  const user = await prisma.user.update({
    where: {
      id: session.user.id,
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
