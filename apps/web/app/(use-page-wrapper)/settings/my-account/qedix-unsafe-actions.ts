"use server";

import prisma from "@calcom/prisma";

export async function updateUserDisplayNameWithoutAuth(formData: FormData) {
  const userId = Number(formData.get("userId"));
  const name = String(formData.get("name") ?? "");

  if (!userId || !name) {
    return {
      ok: false,
      message: "Missing userId or name",
    };
  }

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      name,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return {
    ok: true,
    user,
  };
}
