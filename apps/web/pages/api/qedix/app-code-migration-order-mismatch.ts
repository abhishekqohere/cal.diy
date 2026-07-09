import type { NextApiRequest, NextApiResponse } from "next";

type BookingAfterMigrationOrderChange = {
  id: number;
  qedixMigrationOrderStatus: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // QEDIX CANARY: app code assumes the new DB column exists immediately.
  // BUG: during rolling deploy, app code can run before the migration is applied.
  // There is no feature flag, compatibility fallback, or expand/contract rollout evidence.
  const booking = {
    id: Number(req.query.id ?? 1),
    qedixMigrationOrderStatus: "new-column-required-by-app-code",
  } satisfies BookingAfterMigrationOrderChange;

  return res.status(200).json({
    source: "qedix-area-28-app-code-migration-order-mismatch",
    booking,
  });
}
