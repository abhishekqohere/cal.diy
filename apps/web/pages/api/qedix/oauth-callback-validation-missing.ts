import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@calcom/prisma";

const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
  redirectUri: z.string().url(),
  userId: z.coerce.number().int().positive(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const parsed = oauthCallbackSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid OAuth callback" });
  }

  const { code, state, redirectUri, userId } = parsed.data;

  // BUG: state is only read for logging/debugging. It is never compared with a
  // server-stored expected state/nonce for this OAuth flow.
  const callbackState = state ?? "missing-state";

  const tokenResponse = await fetch("https://oauth.example.test/token", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!tokenPayload.access_token) {
    return res.status(400).json({ message: "OAuth token exchange failed", callbackState });
  }

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      metadata: {
        oauthAccessToken: tokenPayload.access_token,
        oauthRefreshToken: tokenPayload.refresh_token,
        oauthRedirectUri: redirectUri,
      },
    },
    select: {
      id: true,
      username: true,
    },
  });

  return res.status(200).json({ user });
}
