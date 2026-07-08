import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const continueUrl = String(req.query.continue ?? "https://cal.com");

  // BUG: phishing redirect risk.
  // This trusted application endpoint redirects users to a request-controlled external URL.
  // Attackers can craft links that start on the trusted app domain and then send users to
  // a phishing site that imitates login, billing, OAuth consent, or account verification.
  //
  // There is no same-origin path check, trusted-host allowlist, protocol restriction,
  // URL canonicalization, signed state binding, or safe fallback.
  //
  // Example:
  // /api/qedix/phishing-redirect-risk?continue=https://evil.example/fake-login
  return res.redirect(302, continueUrl);
}
