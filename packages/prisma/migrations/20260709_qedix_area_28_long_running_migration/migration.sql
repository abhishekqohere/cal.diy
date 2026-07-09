-- QEDIX CANARY: Area 28.7 Long-running migration
-- BUG: production migration performs full-table updates and blocking index creation.
-- Expected Qedix signal: Long-running migration / full-table update / lock risk / missing batching.

UPDATE "Booking"
SET "description" = COALESCE("description", 'qedix backfill')
WHERE "description" IS NULL;

CREATE INDEX "Booking_description_idx" ON "Booking" ("description");
