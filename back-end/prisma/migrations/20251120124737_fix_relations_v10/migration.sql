/*
  Warnings:

  - Made the column `aiDynamicPricing` on table `BrandPricing` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "BrandPricing" ALTER COLUMN "aiDynamicPricing" SET NOT NULL;

-- CreateTable
CREATE TABLE "AIPricingHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "oldNet" DOUBLE PRECISION,
    "newNet" DOUBLE PRECISION,
    "recommendedPct" DOUBLE PRECISION,
    "appliedPct" DOUBLE PRECISION,
    "aiScore" DOUBLE PRECISION,
    "mode" TEXT,
    "marginBefore" DOUBLE PRECISION,
    "marginAfter" DOUBLE PRECISION,
    "competitorBefore" DOUBLE PRECISION,
    "competitorAfter" DOUBLE PRECISION,
    "stockBefore" DOUBLE PRECISION,
    "stockAfter" DOUBLE PRECISION,
    "demandBefore" DOUBLE PRECISION,
    "demandAfter" DOUBLE PRECISION,
    "salesChangePct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIPricingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIPricingWeights" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "marginWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "costWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "competitorWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "stockWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIPricingWeights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AILearningJournal" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AILearningJournal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIPricingWeights_mode_key" ON "AIPricingWeights"("mode");

-- AddForeignKey
ALTER TABLE "AIPricingHistory" ADD CONSTRAINT "AIPricingHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BrandProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AILearningJournal" ADD CONSTRAINT "AILearningJournal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BrandProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
