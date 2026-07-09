-- QEDIX CANARY: Area 28.2 Column drop
-- BUG: production migration drops a column and deletes stored data.
-- Expected Qedix signal: Column drop / DROP COLUMN / data loss / compatibility risk.

ALTER TABLE "Booking" DROP COLUMN "description";
