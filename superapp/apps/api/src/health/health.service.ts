import { Injectable } from "@nestjs/common";
import { DomainService } from "../domain/domain.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class HealthService {
  constructor(
    private readonly domainService: DomainService,
    private readonly prismaService: PrismaService
  ) {}

  async check() {
    const db = await this.prismaService.checkHealth();
    return {
      status: "ok",
      uptime: process.uptime(),
      domain: this.domainService.status(),
      db,
      timestamp: new Date().toISOString(),
    };
  }
}
