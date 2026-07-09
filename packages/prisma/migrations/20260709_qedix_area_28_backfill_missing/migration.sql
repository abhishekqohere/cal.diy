-- QEDIX CANARY: Area 28.6 Backfill missing
-- BUG: production migration adds a required column without DEFAULT or UPDATE backfill.
-- Existing Booking rows will not have riskScore populated before the NOT NULL requirement.
-- Expected Qedix signal: Backfill missing / required column without default/backfill.

ALTER TABLE "Booking" ADD COLUMN "riskScore" INTEGER NOT NULL;
