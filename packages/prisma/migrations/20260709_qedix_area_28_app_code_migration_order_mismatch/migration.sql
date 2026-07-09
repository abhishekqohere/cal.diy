-- QEDIX CANARY: Area 28.9 App code and migration order mismatch
-- BUG: migration adds a new production column, while app code in the same PR immediately assumes it exists.
-- If app code deploys before this migration, reads/writes can fail during rolling deployment.
-- Expected Qedix signal: App code and migration order mismatch / deploy-order compatibility risk.

ALTER TABLE "Booking" ADD COLUMN "qedixMigrationOrderStatus" TEXT;
