import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@mh-superapp/prisma";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ log: ["warn", "error"] });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async checkHealth() {
    try {
      await this.$queryRaw`SELECT 1`;
      return { status: "up" };
    } catch (error) {
      return {
        status: "down",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
