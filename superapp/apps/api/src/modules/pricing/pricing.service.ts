import { Injectable } from "@nestjs/common";
import { PricingDomain } from "@mh-superapp/domain";
import { PricingRepositoryPrismaAdapter } from "../../repositories/pricing.prisma-adapter.js";

@Injectable()
export class PricingService {
  private readonly getSnapshot: PricingDomain.GetProductPricingSnapshotUseCase;
  private readonly simulate: PricingDomain.SimulatePricingScenarioUseCase;
  private readonly createDraft: PricingDomain.CreatePriceDraftUseCase;
  private readonly approveDraft: PricingDomain.ApprovePriceDraftUseCase;
  private readonly advice: PricingDomain.GetPricingAdviceUseCase;
  private readonly compare: PricingDomain.CompareCompetitorPricesUseCase;
  private readonly recordLearning: PricingDomain.RecordPricingOutcomeForLearningUseCase;

  constructor(private readonly pricingRepo: PricingRepositoryPrismaAdapter) {
    this.getSnapshot = new PricingDomain.GetProductPricingSnapshotUseCase(pricingRepo);
    this.simulate = new PricingDomain.SimulatePricingScenarioUseCase(pricingRepo);
    this.createDraft = new PricingDomain.CreatePriceDraftUseCase(pricingRepo);
    this.approveDraft = new PricingDomain.ApprovePriceDraftUseCase(pricingRepo);
    this.advice = new PricingDomain.GetPricingAdviceUseCase(pricingRepo);
    this.compare = new PricingDomain.CompareCompetitorPricesUseCase(pricingRepo);
    this.recordLearning = new PricingDomain.RecordPricingOutcomeForLearningUseCase(pricingRepo);
  }

  async getPricingSnapshot(params: { productId: string; channel: string; region?: string }) {
    return this.getSnapshot.execute(params);
  }

  async simulateScenario(params: {
    productId: string;
    channel: string;
    newNetPrice?: number;
    targetMarginPct?: number;
  }) {
    return this.simulate.execute(params);
  }

  async createPriceDraft(params: {
    productId: string;
    channel: string;
    newNet: number;
    createdByUserId: string;
    notes?: string;
  }) {
    return this.createDraft.execute(params);
  }

  async approvePriceDraft(params: { draftId: string; approvedByUserId: string }) {
    return this.approveDraft.execute(params);
  }

  async getPricingAdvice(params: { productId: string; channel: string }) {
    return this.advice.execute(params);
  }

  async compareCompetitors(params: { productId: string; channel?: string }) {
    return this.compare.execute(params);
  }

  async recordOutcome(params: {
    productId: string;
    channel: string;
    period: string;
    salesChangePct?: number;
    stockChangePct?: number;
    notes?: string;
  }) {
    return this.recordLearning.execute(params);
  }
}
