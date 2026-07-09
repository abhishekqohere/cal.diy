-- QEDIX CANARY: Area 28.3 Nullable/non-null change risk
-- BUG: production migration makes a nullable column required without a backfill or default.
-- Existing rows with NULL description values can fail the migration or break writes.
-- Expected Qedix signal: Nullable/non-null change risk / SET NOT NULL / missing backfill.

ALTER TABLE "Booking" ALTER COLUMN "description" SET NOT NULL;
