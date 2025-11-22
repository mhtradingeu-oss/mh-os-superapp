import { ProductRepositoryPort } from "../product/product.repository.js";
import { PricingRepositoryPort } from "./pricing.repository.js";
import {
  CompetitorComparisonDTO,
  PricingAdviceDTO,
  PricingSimulationResultDTO,
  PricingSnapshotDTO,
} from "./pricing.types.js";

export class GetProductPricingSnapshotUseCase {
  constructor(private readonly pricingRepo: PricingRepositoryPort) {}

  async execute(params: {
    productId: string;
    channel: string;
    region?: string;
  }): Promise<PricingSnapshotDTO | null> {
    return this.pricingRepo.getPricingSnapshot(params);
  }
}

export class SimulatePricingScenarioUseCase {
  constructor(private readonly pricingRepo: PricingRepositoryPort) {}

  async execute(input: {
    productId: string;
    channel: string;
    newNetPrice?: number;
    targetMarginPct?: number;
  }): Promise<{
    base: PricingSnapshotDTO | null;
    simulated: PricingSimulationResultDTO | null;
  }> {
    const base = await this.pricingRepo.getPricingSnapshot({
      productId: input.productId,
      channel: input.channel,
    });

    if (!base) {
      return { base: null, simulated: null };
    }

    const vatPct = base.components.vatPct ?? 0;
    const net = input.newNetPrice ?? base.net ?? 0;
    const gross = net != null ? net * (1 + vatPct / 100) : null;
    const marginPct =
      base.components.cogsEur && net != null
        ? ((net - base.components.cogsEur) / net) * 100
        : null;

    const simulated: PricingSimulationResultDTO = {
      newNet: net,
      newGross: gross,
      newMarginPct: marginPct,
      notes: input.targetMarginPct
        ? `Target margin ${input.targetMarginPct}% vs simulated ${marginPct ?? "n/a"}%`
        : undefined,
    };

    return { base, simulated };
  }
}

export class CreatePriceDraftUseCase {
  constructor(private readonly pricingRepo: PricingRepositoryPort) {}

  async execute(params: {
    productId: string;
    channel: string;
    newNet: number;
    createdByUserId: string;
    notes?: string;
  }): Promise<{ draftId: string }> {
    const draft = await this.pricingRepo.createPriceDraft(params);
    await this.pricingRepo.recordPricingHistory({
      productId: params.productId,
      channel: params.channel,
      newNet: params.newNet,
      meta: { createdByUserId: params.createdByUserId, notes: params.notes },
    });
    return draft;
  }
}

export class ApprovePriceDraftUseCase {
  constructor(private readonly pricingRepo: PricingRepositoryPort) {}

  async execute(params: { draftId: string; approvedByUserId: string }): Promise<{
    productId: string;
    applied: boolean;
  }> {
    const approval = await this.pricingRepo.approvePriceDraft(params);
    await this.pricingRepo.recordPricingHistory({
      productId: approval.productId,
      channel: "DEFAULT",
      meta: { approvedByUserId: params.approvedByUserId },
    });
    return approval;
  }
}

export class GetPricingAdviceUseCase {
  constructor(private readonly pricingRepo: PricingRepositoryPort) {}

  async execute(params: {
    productId: string;
    channel: string;
  }): Promise<PricingAdviceDTO | null> {
    const snapshot = await this.pricingRepo.getPricingSnapshot(params);
    if (!snapshot) return null;

    const advice: PricingAdviceDTO = {
      aiScore: this.computeScore(snapshot),
      evaluation: `Channel ${snapshot.channel} net=${snapshot.net ?? "n/a"} margin=${
        snapshot.marginPct ?? "n/a"
      }`,
      risks: [],
      opportunities: [],
      suggestions: [],
    };

    if ((snapshot.marginPct ?? 0) < 25) {
      advice.risks.push("Low margin; consider price increase or cost optimization.");
      advice.suggestions.push("Raise net price modestly or reduce COGS.");
    } else {
      advice.opportunities.push("Margin is healthy; room for promotions.");
      advice.suggestions.push("Test targeted discounts to boost volume.");
    }

    if (!snapshot.net) {
      advice.risks.push("Net price missing; pricing data incomplete.");
      advice.suggestions.push("Ingest pricing data for this channel.");
    }

    return advice;
  }

  private computeScore(snapshot: PricingSnapshotDTO): number {
    const margin = snapshot.marginPct ?? 0;
    const hasPrices = snapshot.net != null && snapshot.gross != null;
    const completeness = hasPrices ? 1 : 0.4;
    const score = Math.min(100, Math.max(0, margin * 1.5 * completeness));
    return Math.round(score);
  }
}

export class CompareCompetitorPricesUseCase {
  constructor(private readonly pricingRepo: PricingRepositoryPort) {}

  async execute(params: {
    productId: string;
    channel?: string;
  }): Promise<CompetitorComparisonDTO> {
    const comparison = await this.pricingRepo.listCompetitorPrices(params);
    const cheapest = comparison.competitors
      .filter((c) => c.netPrice != null)
      .sort((a, b) => (a.netPrice ?? 0) - (b.netPrice ?? 0))[0];

    return {
      ...comparison,
      cheapestCompetitor: cheapest?.competitor,
      priceGapWarning:
        cheapest && comparison.baseNet != null
          ? this.buildGapWarning(comparison.baseNet, cheapest.netPrice ?? 0, comparison.baseCurrency)
          : comparison.priceGapWarning,
    };
  }

  private buildGapWarning(baseNet: number, competitorNet: number, currency: string): string | null {
    const gap = competitorNet - baseNet;
    const gapPct = (gap / baseNet) * 100;
    if (gapPct < -10) return `We are ${(gapPct * -1).toFixed(1)}% above competitor in ${currency}`;
    if (gapPct > 10) return `We are ${gapPct.toFixed(1)}% below competitor in ${currency}`;
    return null;
  }
}

export class RecordPricingOutcomeForLearningUseCase {
  constructor(private readonly pricingRepo: PricingRepositoryPort) {}

  async execute(params: {
    productId: string;
    channel: string;
    period: string;
    salesChangePct?: number;
    stockChangePct?: number;
    notes?: string;
  }): Promise<void> {
    await this.pricingRepo.recordLearningSignal(params);
  }
}
