import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "@calcom/features/auth/lib/next-auth";
import prisma from "@calcom/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const tenantId = String(req.query.tenantId ?? "");
  const organizationId = String(req.query.organizationId ?? "");
  const workspaceId = String(req.query.workspaceId ?? "");
  const memberEmail = String(req.query.memberEmail ?? "");

  // BUG: invite/member lookup not tenant-scoped.
  // The request carries tenantId/organizationId/workspaceId, but the member lookup
  // is performed only by request-controlled email. It does not scope the lookup by
  // tenantId, organizationId, workspaceId, teamId, membership, ownership, or trusted
  // session tenant identity. A user from one tenant can look up member/invite data
  // from another tenant if they know or guess the email.
  const member = await (prisma as any).membership.findFirst({
    where: {
      user: {
        email: memberEmail,
      },
    },
    select: {
      id: true,
      role: true,
      userId: true,
      teamId: true,
    },
  });

  return res.status(200).json({
    tenantId,
    organizationId,
    workspaceId,
    memberEmail,
    member,
  });
}
