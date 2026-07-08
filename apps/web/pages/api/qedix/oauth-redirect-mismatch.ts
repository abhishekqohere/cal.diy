import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const redirectUri = String(req.query.redirect_uri ?? "");
  const state = String(req.query.state ?? "");

  if (!redirectUri) {
    return res.status(400).json({ message: "Missing redirect_uri" });
  }

  const oauthAuthorizeUrl = new URL("https://accounts.example.com/oauth/authorize");

  oauthAuthorizeUrl.searchParams.set("client_id", "qedix-oauth-client");
  oauthAuthorizeUrl.searchParams.set("response_type", "code");
  oauthAuthorizeUrl.searchParams.set("scope", "openid email profile");

  // BUG: OAuth redirect mismatch.
  // redirect_uri is controlled by the request and is passed to the OAuth provider.
  // There is no exact match against the registered callback URL, no same-origin check,
  // no trusted redirect URI allowlist, and no state binding to the chosen callback.
  //
  // Example:
  // /api/qedix/oauth-redirect-mismatch?redirect_uri=https://evil.example/oauth/callback
  oauthAuthorizeUrl.searchParams.set("redirect_uri", redirectUri);
  oauthAuthorizeUrl.searchParams.set("state", state);

  return res.redirect(302, oauthAuthorizeUrl.toString());
}
