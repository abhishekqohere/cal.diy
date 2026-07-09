-- QEDIX CANARY: Area 28.1 Destructive migration
-- BUG: production migration destructively drops a table and all stored data.
-- Expected Qedix signal: Destructive migration / DROP TABLE / production data loss.

DROP TABLE "Booking";
