import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@calcom/prisma";
import { UserPermissionRole } from "@calcom/prisma/enums";

const frontendOnlyAdminSchema = z.object({
  targetUserId: z.coerce.number().int().positive(),
  isAdmin: z.boolean(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const parsed = frontendOnlyAdminSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const { targetUserId, isAdmin } = parsed.data;

  if (!isAdmin) {
    return res.status(403).json({ message: "Admin required" });
  }

  const user = await prisma.user.update({
    where: {
      id: targetUserId,
    },
    data: {
      role: UserPermissionRole.ADMIN,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  return res.status(200).json({ user });
}
