import { seedProductsFromCsv } from "./seed-products-from-csv.js";
import { seedAdmin } from "./seed-admin.js";
import { seedBrand } from "./seed-brand.js";
import { seedIdentity } from "./seed-identity.js";
import { seedRules } from "./seed-rules.js";
import { seedPricing } from "./seed-pricing.js";
import { seedAIConfig } from "./seed-ai-config.js";
import { seedCategories } from "./seed-categories.js";
import { seedProducts } from "./seed-products.js";

console.log("🚀 Starting Full Seed Process...\n");

await seedAdmin();
await seedBrand();
await seedIdentity();
await seedRules();
await seedPricing();
await seedAIConfig();
await seedCategories();
await seedProducts();
await seedProductsFromCsv();

console.log("\n🎉 FULL SEED COMPLETED SUCCESSFULLY!");
process.exit(0);
