import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const returnTo = String(req.query.returnTo ?? "/");

  // BUG: unsafe returnTo parameter.
  // The returnTo query parameter controls where the user is redirected.
  // There is no same-origin path check, trusted-host allowlist, protocol restriction,
  // URL canonicalization, signed state binding, or safe fallback.
  //
  // Example:
  // /api/qedix/unsafe-returnto-parameter?returnTo=https://evil.example/phish
  return res.redirect(302, returnTo);
}
