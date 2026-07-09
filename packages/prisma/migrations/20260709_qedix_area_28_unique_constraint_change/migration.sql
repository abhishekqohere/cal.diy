-- QEDIX CANARY: Area 28.5 Unique constraint change
-- BUG: production migration adds a unique constraint without deduplication/backfill evidence.
-- Existing duplicate userId/eventTypeId rows can fail migration or change booking behavior.
-- Expected Qedix signal: Unique constraint change / ADD CONSTRAINT UNIQUE / missing deduplication.

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_eventTypeId_key" UNIQUE ("userId", "eventTypeId");
