import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // BUG: user-controlled callback URL.
  // The callbackUrl query parameter is trusted as the post-auth redirect target.
  // There is no same-origin check, trusted-host allowlist, protocol restriction,
  // URL canonicalization, signed state binding, or safe fallback.
  //
  // Example:
  // /api/qedix/user-controlled-callback-url?callbackUrl=https://evil.example/phish
  return res.redirect(302, String(req.query.callbackUrl));
}
