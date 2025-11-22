import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module.js";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { ProductRepositoryPrismaAdapter } from "../../repositories/product.prisma-adapter.js";
import { ProductService } from "./product.service.js";

@Module({
  imports: [PrismaModule, PricingModule],
  providers: [ProductRepositoryPrismaAdapter, ProductService],
  exports: [ProductService],
})
export class ProductModule {}
