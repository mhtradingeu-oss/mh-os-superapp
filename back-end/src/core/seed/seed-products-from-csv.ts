import fs from "fs";
import path from "path";
import prisma from "@src/core/prisma.js";

// -------------------------
// SKU Normalizer
// -------------------------
function normalizeSKU(sku: string | undefined | null): string | null {
  if (!sku) return null;

  return sku
    .trim()
    .replace(/[\u2013\u2014]/g, "-") // تحويل EN DASH / EM DASH إلى Hyphen
    .replace(/\s+/g, "")            // إزالة أي فراغات
    .toUpperCase();
}

// -------------------------
// Convert CSV numeric values
// -------------------------
function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (value === "") return null;

  const cleaned = String(value)
    .replace("€", "")
    .replace(",", ".")
    .trim();

  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

// -------------------------
// Slug Generator (safe)
// -------------------------
function generateSlug(name: string, sku: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") +
    "-" +
    sku.toLowerCase()
  );
}

export async function seedProductsFromCsv() {
  console.log("🧴 Importing HAIROTICMEN products from CSV...");

  const brand = await prisma.brand.findFirst({
    where: { slug: "hairoticmen" },
  });

  if (!brand) {
    console.log("❌ Brand HAIROTICMEN not found");
    return;
  }

  // -------------------------
  // Load CSV File
  // -------------------------
  const filePath = path.join(process.cwd(), "data", "hairoticmen-products.csv");

  if (!fs.existsSync(filePath)) {
    console.error("❌ CSV file not found at:", filePath);
    return;
  }

  const raw = fs.readFileSync(filePath, "utf-8");

  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (lines.length < 2) {
    console.error("❌ CSV seems empty");
    return;
  }

  const headerLine = lines[0];
  const delimiter = headerLine.includes(";") ? ";" : ",";
  const header = headerLine.split(delimiter).map((h) => h.trim());

  function col(name: string): number {
    const i = header.indexOf(name);
    if (i === -1) console.warn(`⚠ Missing column: ${name}`);
    return i;
  }

  const idx = {
    sku: col("SKU"),
    name: col("Name"),
    upc: col("UPC"),
    line: col("Line"),
    category: col("Category"),
    status: col("Status"),
    weight: col("Weight_g"),
    netContent: col("Net_Content_ml"),
    unitsPerCarton: col("UnitsPerCarton"),

    factoryPriceUnit: col("FactoryPriceUnit_Manual"),
    totalFactoryPriceCarton: col("TotalFactoryPriceCarton"),
    eprLucid: col("EPR_LUCID_per_unit"),
    shippingInbound: col("Shipping_Inbound_per_unit"),
    gs1: col("GS1_per_unit"),
    retailPackaging: col("Retail_Packaging_per_unit"),
    qcPif: col("QC_PIF_per_unit"),
    operations: col("Operations_per_unit"),
    marketing: col("Marketing_per_unit"),
    cogsEur: col("COGS_EUR"),
    fullCostEur: col("FullCost_EUR"),
    uvpNet: col("UVP_Net"),
    uvpInc: col("UVP_Inc"),
    map: col("MAP"),
    grundpreis: col("Grundpreis"),
    vatPct: col("VAT%"),
    b2cStoreNet: col("B2C_Store_Net"),
    b2cStoreInc: col("B2C_Store_Inc"),
    b2cMarginPct: col("B2C_Margin_Pct"),
    amazonTierKey: col("Amazon_TierKey"),
    amazonNet: col("Amazon_Net"),
    amazonInc: col("Amazon_Inc"),
    amazonMarginPct: col("Amazon_Margin_Pct"),
    dealerBasicNet: col("Dealer_Basic_Net"),
    dealerPlusNet: col("Dealer_Plus_Net"),
    standPartnerNet: col("Stand_Partner_Net"),
    distributorNet: col("Distributor_Net"),
    qrUrl: col("QRUrl"),
  };

  // -------------------------
  // PROCESS EACH ROW
  // -------------------------
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((v) => v.trim());

    const rawSku = cols[idx.sku];
    const normalizedSku = normalizeSKU(rawSku);

    const name = cols[idx.name];
    if (!name) continue;
    if (!normalizedSku) {
      console.warn(`⚠ Skipping invalid SKU → ${name}`);
      continue;
    }

    // SAFE SLUG GENERATION
    const safeSlug = generateSlug(name, normalizedSku);

    const categoryName = cols[idx.category] || "Uncategorized";
    const categorySlug = categoryName.toLowerCase().replace(/\s+/g, "-");

    // -------------------------
    // CATEGORY ENSURE
    // -------------------------
    let category = await prisma.brandCategory.findFirst({
      where: { slug: categorySlug, brandId: brand.id },
    });

    if (!category) {
      category = await prisma.brandCategory.create({
        data: {
          name: categoryName,
          slug: categorySlug,
          brandId: brand.id,
        },
      });
      console.log(`📦 Category created: ${categoryName}`);
    }

    // -------------------------
    // FIND PRODUCT BY SKU ONLY
    // -------------------------
    let product = await prisma.brandProduct.findUnique({
      where: { sku: normalizedSku },
    });

    // -------------------------
    // CREATE or UPDATE PRODUCT
    // -------------------------
    if (!product) {
      product = await prisma.brandProduct.create({
        data: {
          name,
          slug: safeSlug,
          description: `HAIROTICMEN product: ${name}`,
          price: toNumber(cols[idx.b2cStoreInc]) ?? 0,

          brandId: brand.id,
          categoryId: category.id,

          sku: normalizedSku,
          upc: cols[idx.upc] || null,
          line: cols[idx.line] || null,
          status: cols[idx.status] || null,
          weightGrams: toNumber(cols[idx.weight]),
          netContentMl: toNumber(cols[idx.netContent]),
          unitsPerCarton: toNumber(cols[idx.unitsPerCarton]),
          qrUrl: cols[idx.qrUrl] || null,
        },
      });

      console.log(`🆕 Created Product: ${name} (${normalizedSku})`);
    } else {
      product = await prisma.brandProduct.update({
        where: { sku: normalizedSku },
        data: {
          name,
          description: `HAIROTICMEN product: ${name}`,
          price: toNumber(cols[idx.b2cStoreInc]) ?? 0,

          categoryId: category.id,

          upc: cols[idx.upc] || null,
          line: cols[idx.line] || null,
          status: cols[idx.status] || null,
          weightGrams: toNumber(cols[idx.weight]),
          netContentMl: toNumber(cols[idx.netContent]),
          unitsPerCarton: toNumber(cols[idx.unitsPerCarton]),
          qrUrl: cols[idx.qrUrl] || null,
        },
      });

      console.log(`♻️ Updated Product: ${name} (${normalizedSku})`);
    }

    // -------------------------
    // PRICING UPSERT
    // -------------------------
    await prisma.productPricing.upsert({
      where: { productId: product.id },
      update: {
        factoryPriceUnit: toNumber(cols[idx.factoryPriceUnit]),
        totalFactoryPriceCarton: toNumber(cols[idx.totalFactoryPriceCarton]),
        eprLucidPerUnit: toNumber(cols[idx.eprLucid]),
        shippingInboundPerUnit: toNumber(cols[idx.shippingInbound]),
        gs1PerUnit: toNumber(cols[idx.gs1]),
        retailPackagingPerUnit: toNumber(cols[idx.retailPackaging]),
        qcPifPerUnit: toNumber(cols[idx.qcPif]),
        operationsPerUnit: toNumber(cols[idx.operations]),
        marketingPerUnit: toNumber(cols[idx.marketing]),
        cogsEur: toNumber(cols[idx.cogsEur]),
        fullCostEur: toNumber(cols[idx.fullCostEur]),
        uvpNet: toNumber(cols[idx.uvpNet]),
        uvpInc: toNumber(cols[idx.uvpInc]),
        map: toNumber(cols[idx.map]),
        grundpreis: cols[idx.grundpreis] || null,
        vatPct: toNumber(cols[idx.vatPct]),
        b2cStoreNet: toNumber(cols[idx.b2cStoreNet]),
        b2cStoreInc: toNumber(cols[idx.b2cStoreInc]),
        b2cMarginPct: toNumber(cols[idx.b2cMarginPct]),
        amazonTierKey: cols[idx.amazonTierKey] || null,
        amazonNet: toNumber(cols[idx.amazonNet]),
        amazonInc: toNumber(cols[idx.amazonInc]),
        amazonMarginPct: toNumber(cols[idx.amazonMarginPct]),
        dealerBasicNet: toNumber(cols[idx.dealerBasicNet]),
        dealerPlusNet: toNumber(cols[idx.dealerPlusNet]),
        standPartnerNet: toNumber(cols[idx.standPartnerNet]),
        distributorNet: toNumber(cols[idx.distributorNet]),
      },
      create: {
        productId: product.id,
        factoryPriceUnit: toNumber(cols[idx.factoryPriceUnit]),
        totalFactoryPriceCarton: toNumber(cols[idx.totalFactoryPriceCarton]),
        eprLucidPerUnit: toNumber(cols[idx.eprLucid]),
        shippingInboundPerUnit: toNumber(cols[idx.shippingInbound]),
        gs1PerUnit: toNumber(cols[idx.gs1]),
        retailPackagingPerUnit: toNumber(cols[idx.retailPackaging]),
        qcPifPerUnit: toNumber(cols[idx.qcPif]),
        operationsPerUnit: toNumber(cols[idx.operations]),
        marketingPerUnit: toNumber(cols[idx.marketing]),
        cogsEur: toNumber(cols[idx.cogsEur]),
        fullCostEur: toNumber(cols[idx.fullCostEur]),
        uvpNet: toNumber(cols[idx.uvpNet]),
        uvpInc: toNumber(cols[idx.uvpInc]),
        map: toNumber(cols[idx.map]),
        grundpreis: cols[idx.grundpreis] || null,
        vatPct: toNumber(cols[idx.vatPct]),
        b2cStoreNet: toNumber(cols[idx.b2cStoreNet]),
        b2cStoreInc: toNumber(cols[idx.b2cStoreInc]),
        b2cMarginPct: toNumber(cols[idx.b2cMarginPct]),
        amazonTierKey: cols[idx.amazonTierKey] || null,
        amazonNet: toNumber(cols[idx.amazonNet]),
        amazonInc: toNumber(cols[idx.amazonInc]),
        amazonMarginPct: toNumber(cols[idx.amazonMarginPct]),
        dealerBasicNet: toNumber(cols[idx.dealerBasicNet]),
        dealerPlusNet: toNumber(cols[idx.dealerPlusNet]),
        standPartnerNet: toNumber(cols[idx.standPartnerNet]),
        distributorNet: toNumber(cols[idx.distributorNet]),
      },
    });
  }

  console.log("✅ CSV Product Import completed.");
}
