import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const nextUrl = String(req.query.next ?? "/");

  // BUG: open redirect.
  // The redirect target comes directly from req.query.next.
  // There is no same-origin path check, trusted-host allowlist, protocol restriction,
  // URL canonicalization, or safe fallback.
  //
  // Example attacker-controlled value:
  // /api/qedix/open-redirect?next=https://evil.example/phish
  return res.redirect(302, nextUrl);
}
