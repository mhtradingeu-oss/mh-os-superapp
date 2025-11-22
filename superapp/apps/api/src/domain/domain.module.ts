import { Module } from "@nestjs/common";
import { DomainService } from "./domain.service.js";

@Module({
  providers: [DomainService],
  exports: [DomainService],
})
export class DomainModule {}
