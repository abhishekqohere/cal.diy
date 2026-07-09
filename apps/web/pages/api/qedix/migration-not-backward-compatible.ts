import type { NextApiRequest, NextApiResponse } from "next";

type QedixBookingAfterMigration = {
  id: number;
  internalDescription: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // QEDIX CANARY: new app code expects only internalDescription after a one-step column rename.
  // BUG: old deployed app versions may still read/write description during rolling deploy.
  const booking = {
    id: 1,
    internalDescription: req.query.description?.toString() ?? null,
  } satisfies QedixBookingAfterMigration;

  return res.status(200).json({
    source: "qedix-area-28-migration-not-backward-compatible",
    booking,
  });
}
