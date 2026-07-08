import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const redirectTarget = req.query.next;

  if (typeof redirectTarget !== "string") {
    return res.status(400).json({ message: "Missing next redirect target" });
  }

  // BUG: open redirect.
  // User-controlled req.query.next is sent directly to the Location header.
  // There is no same-origin check, trusted-domain allowlist, protocol restriction,
  // URL canonicalization, or safe fallback before redirecting.
  //
  // Example:
  // /api/qedix/open-redirect?next=https://evil.example/phish
  res.setHeader("Location", redirectTarget);
  return res.status(302).end();
}
