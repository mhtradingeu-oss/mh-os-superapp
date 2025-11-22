import { Logger, Module } from "@nestjs/common";
import { DomainModule } from "./domain/domain.module.js";
import { HealthModule } from "./health/health.module.js";
import { PricingModule } from "./modules/pricing/pricing.module.js";
import { ProductModule } from "./modules/product/product.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [HealthModule, PrismaModule, DomainModule, ProductModule, PricingModule],
  providers: [Logger],
})
export class AppModule {}
