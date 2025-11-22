import {
  CompetitorComparisonDTO,
  PricingSnapshotDTO,
} from "./pricing.types.js";

export interface PricingRepositoryPort {
  getPricingSnapshot(params: {
    productId: string;
    channel: string;
    region?: string;
  }): Promise<PricingSnapshotDTO | null>;

  listCompetitorPrices(params: {
    productId: string;
    channel?: string;
  }): Promise<CompetitorComparisonDTO>;

  createPriceDraft(params: {
    productId: string;
    channel: string;
    newNet: number;
    createdByUserId: string;
    notes?: string;
  }): Promise<{ draftId: string }>;

  approvePriceDraft(params: {
    draftId: string;
    approvedByUserId: string;
  }): Promise<{ productId: string; applied: boolean }>;

  recordPricingHistory(params: {
    productId: string;
    channel: string;
    oldNet?: number | null;
    newNet?: number | null;
    marginBefore?: number | null;
    marginAfter?: number | null;
    meta?: Record<string, unknown>;
  }): Promise<void>;

  recordLearningSignal(params: {
    productId: string;
    channel: string;
    period: string;
    salesChangePct?: number;
    stockChangePct?: number;
    notes?: string;
  }): Promise<void>;
}
