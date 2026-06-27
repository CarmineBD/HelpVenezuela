ALTER TYPE "HelpPostStatus" ADD VALUE IF NOT EXISTS 'HIDDEN';
ALTER TYPE "HelpPostStatus" ADD VALUE IF NOT EXISTS 'DELETED';

CREATE TABLE "Person" (
  "id" TEXT NOT NULL,
  "identityCard" TEXT NOT NULL,
  "name" TEXT,
  "contact" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Person_identityCard_key" ON "Person"("identityCard");

INSERT INTO "Person" ("id", "identityCard", "name", "contact", "createdAt", "updatedAt")
SELECT 'legacy-' || "id", 'LEGACY-' || "id", "name", "contact", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "HelpPost";

ALTER TABLE "HelpPost" ADD COLUMN "personId" TEXT;
ALTER TABLE "HelpPost" ADD COLUMN "publicLatitude" DOUBLE PRECISION;
ALTER TABLE "HelpPost" ADD COLUMN "publicLongitude" DOUBLE PRECISION;
ALTER TABLE "HelpPost" ADD COLUMN "timeFrom" TEXT;
ALTER TABLE "HelpPost" ADD COLUMN "timeTo" TEXT;

UPDATE "HelpPost"
SET
  "personId" = 'legacy-' || "id",
  "publicLatitude" = ROUND(("latitude")::numeric, 2)::double precision,
  "publicLongitude" = ROUND(("longitude")::numeric, 2)::double precision;

ALTER TABLE "HelpPost" ALTER COLUMN "personId" SET NOT NULL;
ALTER TABLE "HelpPost" ALTER COLUMN "publicLatitude" SET NOT NULL;
ALTER TABLE "HelpPost" ALTER COLUMN "publicLongitude" SET NOT NULL;

ALTER TABLE "HelpPost" DROP COLUMN "dateFrom";
ALTER TABLE "HelpPost" DROP COLUMN "dateTo";
ALTER TABLE "HelpPost" DROP COLUMN "timeSlot";
ALTER TABLE "HelpPost" DROP COLUMN "deleteToken";

ALTER TABLE "HelpType" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "HelpType" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "HelpPostReport" (
  "id" TEXT NOT NULL,
  "helpPostId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HelpPostReport_pkey" PRIMARY KEY ("id")
);

DROP INDEX IF EXISTS "HelpPost_deleteToken_key";
DROP INDEX IF EXISTS "HelpPost_latitude_longitude_idx";
CREATE INDEX "HelpPost_personId_idx" ON "HelpPost"("personId");
CREATE INDEX "HelpPost_publicLatitude_publicLongitude_idx" ON "HelpPost"("publicLatitude", "publicLongitude");
CREATE INDEX "HelpPost_timeFrom_timeTo_idx" ON "HelpPost"("timeFrom", "timeTo");
CREATE INDEX "HelpPostType_helpTypeId_idx" ON "HelpPostType"("helpTypeId");
CREATE INDEX "HelpPostReport_helpPostId_idx" ON "HelpPostReport"("helpPostId");

ALTER TABLE "HelpPost"
  ADD CONSTRAINT "HelpPost_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HelpPostReport"
  ADD CONSTRAINT "HelpPostReport_helpPostId_fkey"
  FOREIGN KEY ("helpPostId") REFERENCES "HelpPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
