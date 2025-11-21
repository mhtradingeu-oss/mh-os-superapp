/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `BrandCategory` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BrandProduct" ALTER COLUMN "price" DROP DEFAULT;

-- CreateTable
CREATE TABLE "BrandIdentity" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "vision" TEXT,
    "mission" TEXT,
    "values" TEXT,
    "toneOfVoice" TEXT,
    "persona" TEXT,
    "brandStory" TEXT,
    "keywords" TEXT,
    "colorPalette" TEXT,
    "guidelineUrl" TEXT,
    "packagingStyle" TEXT,
    "socialProfiles" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRules" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "namingRules" TEXT,
    "descriptionRules" TEXT,
    "messagingRules" TEXT,
    "marketingRules" TEXT,
    "discountRules" TEXT,
    "pricingRules" TEXT,
    "stockRules" TEXT,
    "restrictedWords" TEXT,
    "allowedWords" TEXT,
    "aiRestrictions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandRules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandPricing" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "costMultiplier" DOUBLE PRECISION,
    "wholesaleMultiplier" DOUBLE PRECISION,
    "retailMultiplier" DOUBLE PRECISION,
    "standDiscount" DOUBLE PRECISION,
    "onlineDiscount" DOUBLE PRECISION,
    "dealerDiscount" DOUBLE PRECISION,
    "loyaltyEarnRate" DOUBLE PRECISION,
    "loyaltyRedeemRate" DOUBLE PRECISION,
    "aiDynamicPricing" BOOLEAN DEFAULT false,
    "aiMarketFactor" DOUBLE PRECISION,
    "aiCompetitionFactor" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAIConfig" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "aiPersonality" TEXT,
    "aiVoiceStyle" TEXT,
    "aiContentStyle" TEXT,
    "aiPricingStyle" TEXT,
    "aiEnabledActions" TEXT,
    "aiBlockedTopics" TEXT,
    "aiModelVersion" TEXT,
    "aiTone" TEXT,
    "aiWritingRules" TEXT,
    "aiPricingRules" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAIConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandIdentity_brandId_key" ON "BrandIdentity"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandRules_brandId_key" ON "BrandRules"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandPricing_brandId_key" ON "BrandPricing"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandAIConfig_brandId_key" ON "BrandAIConfig"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandCategory_slug_key" ON "BrandCategory"("slug");

-- AddForeignKey
ALTER TABLE "BrandIdentity" ADD CONSTRAINT "BrandIdentity_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRules" ADD CONSTRAINT "BrandRules_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandPricing" ADD CONSTRAINT "BrandPricing_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAIConfig" ADD CONSTRAINT "BrandAIConfig_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
