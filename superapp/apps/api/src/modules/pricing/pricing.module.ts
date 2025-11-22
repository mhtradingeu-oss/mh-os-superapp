import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { PricingRepositoryPrismaAdapter } from "../../repositories/pricing.prisma-adapter.js";
import { PricingService } from "./pricing.service.js";

@Module({
  imports: [PrismaModule],
  providers: [PricingRepositoryPrismaAdapter, PricingService],
  exports: [PricingRepositoryPrismaAdapter, PricingService],
})
export class PricingModule {}
