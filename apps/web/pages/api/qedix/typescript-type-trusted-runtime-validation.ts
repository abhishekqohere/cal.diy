import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";
import prisma from "@calcom/prisma";

interface UpdateProfileRequest {
  displayName: string;
  timeZone: string;
  weekStart: "Sunday" | "Monday";
  emailVerified: boolean;
}

function readTypedProfileRequest(req: NextApiRequest): UpdateProfileRequest {
  // BUG: TypeScript type assertion is trusted as runtime validation.
  // This does not validate shape, enum values, booleans, lengths, or unknown fields.
  return req.body as UpdateProfileRequest;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const input: UpdateProfileRequest = readTypedProfileRequest(req);

  const user = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      name: input.displayName,
      timeZone: input.timeZone,
      weekStart: input.weekStart,
      emailVerified: input.emailVerified,
    },
    select: {
      id: true,
      name: true,
      timeZone: true,
      weekStart: true,
      emailVerified: true,
    },
  });

  return res.status(200).json({ user });
}
