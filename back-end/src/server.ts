import pricingRoutes from "@src/modules/pricing/pricing.routes.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// 🌐 Routes
import authRoutes from "@src/modules/auth/auth.routes.js";
import categoryRoutes from "@src/modules/brands/hairoticmen/categories/category.routes.js";
import productRoutes from "@src/modules/products/product.routes.js";
import insightsRoutes from "@src/modules/insights/insights.routes.js";



// 🌱 Seeders
import { seedAdmin } from "@src/core/seed/seed-admin.js";
import { seedBrand } from "@src/core/seed/seed-brand.js";
import { seedProductsFromCsv } from "@src/core/seed/seed-products-from-csv.js";
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());


// 🔧 Config
const API_PREFIX = process.env.API_PREFIX || "/api/v1";
const PORT = process.env.PORT || 5050;




// 🚀 Seeders (ONE TIME)
// -------------------------------

await seedAdmin();
await seedBrand();
await seedProductsFromCsv();

// -------------------------------
// 🔐 Auth Routes
// -------------------------------

app.use(`${API_PREFIX}/auth`, authRoutes);

// -------------------------------
// 🏷 Brand Routes
// -------------------------------

app.use(`${API_PREFIX}/brands`, categoryRoutes);

// -------------------------------
// Pricing module
// -------------------------------
app.use(`${API_PREFIX}/pricing`, pricingRoutes);
app.use(`${API_PREFIX}/insights`, insightsRoutes);


// -------------------------------
// 🧴 Product Routes (NEW GLOBAL)
// -------------------------------
app.use(`${API_PREFIX}/products`, productRoutes);
// -------------------------------
// 🏠 Root Test Route
// -------------------------------

app.get(`${API_PREFIX}`, (req, res) => {
  res.json({
    status: "success",
    message: "MH Trading Backend (Hairoticmen Brand) is running 🎉",
  });
});

// -------------------------------
// 🚀 Server Start
// -------------------------------

app.listen(PORT, () => {
  console.log(`🚀 MH Trading server running on port ${PORT}`);
  console.log(`🔗 API prefix: "${API_PREFIX}"`);
});
