import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";
import prisma from "@calcom/prisma";

type ProfileSettingsInput = {
  displayName: string;
  timeZone: string;
  weekStart: string;
  locale: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // BUG: typed request body is trusted without zod/yup/joi/class-validator runtime validation.
  const input = req.body as ProfileSettingsInput;

  const user = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      name: input.displayName,
      timeZone: input.timeZone,
      weekStart: input.weekStart,
      locale: input.locale,
    },
    select: {
      id: true,
      name: true,
      timeZone: true,
      weekStart: true,
      locale: true,
    },
  });

  return res.status(200).json({ user });
}
