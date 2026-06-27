CREATE TYPE "HelpPostKind" AS ENUM ('NEED', 'OFFER');
CREATE TYPE "HelpPostStatus" AS ENUM ('ACTIVE', 'MATCHED', 'CLOSED', 'REPORTED');
CREATE TYPE "Urgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "HelpPost" (
  "id" TEXT NOT NULL,
  "kind" "HelpPostKind" NOT NULL,
  "name" TEXT NOT NULL,
  "contact" TEXT NOT NULL,
  "locationLabel" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "dateFrom" TIMESTAMP(3) NOT NULL,
  "dateTo" TIMESTAMP(3) NOT NULL,
  "timeSlot" TEXT NOT NULL,
  "urgency" "Urgency",
  "description" TEXT NOT NULL,
  "status" "HelpPostStatus" NOT NULL DEFAULT 'ACTIVE',
  "deleteToken" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HelpPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HelpType" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,

  CONSTRAINT "HelpType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HelpPostType" (
  "helpPostId" TEXT NOT NULL,
  "helpTypeId" TEXT NOT NULL,

  CONSTRAINT "HelpPostType_pkey" PRIMARY KEY ("helpPostId", "helpTypeId")
);

CREATE UNIQUE INDEX "HelpPost_deleteToken_key" ON "HelpPost"("deleteToken");
CREATE INDEX "HelpPost_kind_status_idx" ON "HelpPost"("kind", "status");
CREATE INDEX "HelpPost_latitude_longitude_idx" ON "HelpPost"("latitude", "longitude");
CREATE UNIQUE INDEX "HelpType_slug_key" ON "HelpType"("slug");

ALTER TABLE "HelpPostType"
  ADD CONSTRAINT "HelpPostType_helpPostId_fkey"
  FOREIGN KEY ("helpPostId") REFERENCES "HelpPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HelpPostType"
  ADD CONSTRAINT "HelpPostType_helpTypeId_fkey"
  FOREIGN KEY ("helpTypeId") REFERENCES "HelpType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
