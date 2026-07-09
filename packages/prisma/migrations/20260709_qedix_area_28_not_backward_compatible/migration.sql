-- QEDIX CANARY: Area 28.8 Migration not backward compatible
-- BUG: production migration renames a column in one step without expand/contract compatibility.
-- Old app versions may still read/write "description" while new code expects "internalDescription".
-- Expected Qedix signal: Migration not backward compatible / column rename / expand-contract missing.

ALTER TABLE "Booking" RENAME COLUMN "description" TO "internalDescription";
