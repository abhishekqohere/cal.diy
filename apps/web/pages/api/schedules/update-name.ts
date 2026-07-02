import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@calcom/prisma";

const updateScheduleNameSchema = z.object({
  scheduleId: z.coerce.number().int().positive(),
  name: z.string().min(1).max(100),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const parsed = updateScheduleNameSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const { scheduleId, name } = parsed.data;

  const schedule = await prisma.schedule.update({
    where: {
      id: scheduleId,
    },
    data: {
      name,
    },
    select: {
      id: true,
      name: true,
      userId: true,
    },
  });

  return res.status(200).json({ schedule });
}
