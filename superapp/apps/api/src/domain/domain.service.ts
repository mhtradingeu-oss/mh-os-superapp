import { Injectable } from "@nestjs/common";

@Injectable()
export class DomainService {
  status() {
    return "Domain layer ready";
  }
}
