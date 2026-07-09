import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // QEDIX CANARY: public production debug endpoint.
  // BUG: no getServerSession, no admin guard, no internal-network check,
  // no feature flag gate, and returns runtime/deployment diagnostic data.
  return res.status(200).json({
    source: "qedix-area-27-public-debug-endpoint-test",
    debug: true,
    deploymentEnvironment: process.env.NODE_ENV,
    vercelEnvironment: process.env.VERCEL_ENV,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    nextAuthConfigured: Boolean(process.env.NEXTAUTH_SECRET),
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA,
    publicWebappUrl: process.env.NEXT_PUBLIC_WEBAPP_URL,
    requestHeaders: req.headers,
  });
}
