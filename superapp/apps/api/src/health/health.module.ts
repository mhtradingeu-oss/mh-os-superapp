import { Module } from "@nestjs/common";
import { DomainModule } from "../domain/domain.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

@Module({
  imports: [DomainModule, PrismaModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
