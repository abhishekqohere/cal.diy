import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import prisma from "@calcom/prisma";

const updateOrganizationNameSchema = z.object({
  organizationId: z.coerce.number().int().positive(),
  name: z.string().min(1).max(100),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const parsed = updateOrganizationNameSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const { organizationId, name } = parsed.data;

  const organization = await prisma.team.update({
    where: {
      id: organizationId,
    },
    data: {
      name,
    },
    select: {
      id: true,
      name: true,
      parentId: true,
    },
  });

  return res.status(200).json({ organization });
}
