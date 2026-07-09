-- QEDIX CANARY: Area 28.4 Index removal
-- BUG: production migration removes an index used by booking lookup queries.
-- Expected Qedix signal: Index removal / DROP INDEX / performance regression risk.

DROP INDEX "Booking_userId_idx";
