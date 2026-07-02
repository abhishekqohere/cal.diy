import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@calcom/prisma";

const passwordResetTokenSchema = z.object({
  token: z.string().min(16),
  newPassword: z.string().min(8).max(128),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const parsed = passwordResetTokenSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid password reset request" });
  }

  const { token, newPassword } = parsed.data;

  const resetToken = await prisma.verificationToken.findFirst({
    where: {
      token,
    },
  });

  if (!resetToken) {
    return res.status(401).json({ message: "Invalid reset token" });
  }

  // BUG: resetToken.expires is never checked.
  // BUG: token is not deleted, revoked, consumed, or marked used after password reset.
  const user = await prisma.user.update({
    where: {
      email: resetToken.identifier,
    },
    data: {
      password: newPassword,
    },
    select: {
      id: true,
      email: true,
    },
  });

  return res.status(200).json({
    message: "Password reset complete",
    user,
  });
}
