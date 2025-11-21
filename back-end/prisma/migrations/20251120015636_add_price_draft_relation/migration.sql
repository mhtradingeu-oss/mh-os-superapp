-- CreateTable
CREATE TABLE "ProductPriceDraft" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "oldNet" DOUBLE PRECISION,
    "oldGross" DOUBLE PRECISION,
    "oldMargin" DOUBLE PRECISION,
    "newNet" DOUBLE PRECISION,
    "newGross" DOUBLE PRECISION,
    "newMargin" DOUBLE PRECISION,
    "changePct" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPriceDraft_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProductPriceDraft" ADD CONSTRAINT "ProductPriceDraft_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BrandProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
