/*
  Warnings:

  - A unique constraint covering the columns `[sku]` on the table `BrandProduct` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BrandProduct" ADD COLUMN     "line" TEXT,
ADD COLUMN     "netContentMl" DOUBLE PRECISION,
ADD COLUMN     "qrUrl" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "unitsPerCarton" INTEGER,
ADD COLUMN     "upc" TEXT,
ADD COLUMN     "weightGrams" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ProductPricing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "factoryPriceUnit" DOUBLE PRECISION,
    "totalFactoryPriceCarton" DOUBLE PRECISION,
    "eprLucidPerUnit" DOUBLE PRECISION,
    "shippingInboundPerUnit" DOUBLE PRECISION,
    "gs1PerUnit" DOUBLE PRECISION,
    "retailPackagingPerUnit" DOUBLE PRECISION,
    "qcPifPerUnit" DOUBLE PRECISION,
    "operationsPerUnit" DOUBLE PRECISION,
    "marketingPerUnit" DOUBLE PRECISION,
    "cogsEur" DOUBLE PRECISION,
    "fullCostEur" DOUBLE PRECISION,
    "uvpNet" DOUBLE PRECISION,
    "uvpInc" DOUBLE PRECISION,
    "map" DOUBLE PRECISION,
    "grundpreis" TEXT,
    "vatPct" DOUBLE PRECISION,
    "b2cStoreNet" DOUBLE PRECISION,
    "b2cStoreInc" DOUBLE PRECISION,
    "b2cMarginPct" DOUBLE PRECISION,
    "amazonTierKey" TEXT,
    "amazonNet" DOUBLE PRECISION,
    "amazonInc" DOUBLE PRECISION,
    "amazonMarginPct" DOUBLE PRECISION,
    "dealerBasicNet" DOUBLE PRECISION,
    "dealerPlusNet" DOUBLE PRECISION,
    "standPartnerNet" DOUBLE PRECISION,
    "distributorNet" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductPricing_productId_key" ON "ProductPricing"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProduct_sku_key" ON "BrandProduct"("sku");

-- AddForeignKey
ALTER TABLE "ProductPricing" ADD CONSTRAINT "ProductPricing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BrandProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
