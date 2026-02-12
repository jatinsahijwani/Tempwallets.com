/*
  Warnings:

  - You are about to drop the `RateLimit` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."RateLimit";

-- CreateTable
CREATE TABLE "DeviceRateLimit" (
    "deviceId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceRateLimit_pkey" PRIMARY KEY ("deviceId")
);
