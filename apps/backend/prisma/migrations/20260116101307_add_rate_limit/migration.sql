-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_deviceId_key" ON "RateLimit"("deviceId");

-- CreateIndex
CREATE INDEX "RateLimit_deviceId_idx" ON "RateLimit"("deviceId");
