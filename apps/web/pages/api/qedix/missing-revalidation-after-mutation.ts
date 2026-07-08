import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { prisma } from "@calcom/prisma";

const teamProfileCache = new Map<string, unknown>();

const updateTeamProfileSchema = z.object({
  teamId: z.coerce.number().int().positive(),
  name: z.string().min(1).max(100),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.method === "GET") {
    const teamId = Number(req.query.teamId);

    if (!teamId) {
      return res.status(400).json({ message: "Missing teamId" });
    }

    const cachedTeamProfile = teamProfileCache.get(`team:${teamId}:profile`);

    if (cachedTeamProfile) {
      return res.status(200).json({
        source: "qedix-area-24-missing-revalidation-after-mutation-test",
        fromCache: true,
        team: cachedTeamProfile,
      });
    }

    const membership = await prisma.membership.findFirst({
      where: {
        userId: Number(session.user.id),
        teamId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!membership) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        metadata: true,
        updatedAt: true,
      },
    });

    teamProfileCache.set(`team:${teamId}:profile`, team);

    return res.status(200).json({
      source: "qedix-area-24-missing-revalidation-after-mutation-test",
      fromCache: false,
      team,
    });
  }

  if (req.method === "POST") {
    const parsed = updateTeamProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const { teamId, name } = parsed.data;

    const membership = await prisma.membership.findFirst({
      where: {
        userId: Number(session.user.id),
        teamId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!membership || !["ADMIN", "OWNER"].includes(membership.role)) {
      return res.status(403).json({ message: "Requires team admin permission" });
    }

    const updatedTeam = await prisma.team.update({
      where: {
        id: teamId,
      },
      data: {
        name,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        metadata: true,
        updatedAt: true,
      },
    });

    // BUG: DB mutation updates team profile but does not invalidate/revalidate the cached GET response.
    // Missing:
    // - teamProfileCache.delete(`team:${teamId}:profile`)
    // - revalidatePath(...)
    // - revalidateTag(...)
    // - cache invalidation event
    // - cache version bump
    // - TTL/freshness strategy after mutation
    //
    // Users can keep receiving stale team name/settings from the cache after the mutation succeeds.

    return res.status(200).json({
      source: "qedix-area-24-missing-revalidation-after-mutation-test",
      updatedTeam,
    });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
