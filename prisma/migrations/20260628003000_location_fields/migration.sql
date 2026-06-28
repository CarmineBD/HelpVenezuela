CREATE TYPE "LocationSource" AS ENUM ('ADDRESS', 'CURRENT_LOCATION');

ALTER TABLE "HelpPost"
  ADD COLUMN "locationSource" "LocationSource" NOT NULL DEFAULT 'ADDRESS',
  ADD COLUMN "state" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "referencePoint" TEXT;

