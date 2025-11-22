import { Injectable } from "@nestjs/common";
import { PricingDomain } from "@mh-superapp/domain";
import { Prisma } from "@mh-superapp/prisma";
import { PrismaService } from "../prisma/prisma.service.js";

const toSnapshot = (
  productId: string,
  channel: string,
  pricing: {
    cogsEur?: number | null;
    fullCostEur?: number | null;
    uvpNet?: number | null;
    uvpInc?: number | null;
    map?: number | null;
    vatPct?: number | null;
    b2cStoreNet?: number | null;
    b2cStoreInc?: number | null;
    amazonNet?: number | null;
    amazonInc?: number | null;
    dealerBasicNet?: number | null;
    dealerPlusNet?: number | null;
    standPartnerNet?: number | null;
    distributorNet?: number | null;
  }
): PricingDomain.PricingSnapshotDTO => ({
  productId,
  channel,
  net: pricing.uvpNet ?? pricing.b2cStoreNet ?? null,
  gross: pricing.uvpInc ?? pricing.b2cStoreInc ?? null,
  marginPct:
    pricing.uvpNet && pricing.cogsEur
      ? ((pricing.uvpNet - pricing.cogsEur) / pricing.uvpNet) * 100
      : null,
  currency: "EUR",
  components: {
    cogsEur: pricing.cogsEur ?? null,
    fullCostEur: pricing.fullCostEur ?? null,
    uvpNet: pricing.uvpNet ?? null,
    uvpInc: pricing.uvpInc ?? null,
    map: pricing.map ?? null,
    vatPct: pricing.vatPct ?? null,
    b2cStoreNet: pricing.b2cStoreNet ?? null,
    b2cStoreInc: pricing.b2cStoreInc ?? null,
    amazonNet: pricing.amazonNet ?? null,
    amazonInc: pricing.amazonInc ?? null,
    dealerBasicNet: pricing.dealerBasicNet ?? null,
    dealerPlusNet: pricing.dealerPlusNet ?? null,
    standPartnerNet: pricing.standPartnerNet ?? null,
    distributorNet: pricing.distributorNet ?? null,
  },
});

@Injectable()
export class PricingRepositoryPrismaAdapter implements PricingDomain.PricingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getPricingSnapshot(params: {
    productId: string;
    channel: string;
    region?: string | undefined;
  }): Promise<PricingDomain.PricingSnapshotDTO | null> {
    const pricing = await this.prisma.productPricing.findUnique({
      where: { productId: params.productId },
    });

    if (!pricing) return null;
    return toSnapshot(params.productId, params.channel, pricing);
  }

  async listCompetitorPrices(params: {
    productId: string;
    channel?: string;
  }): Promise<PricingDomain.CompetitorComparisonDTO> {
    const [competitors, pricing] = await this.prisma.$transaction([
      this.prisma.competitorPrice.findMany({
        where: {
          productId: params.productId,
          channel: params.channel,
        },
      }),
      this.prisma.productPricing.findUnique({ where: { productId: params.productId } }),
    ]);

    const baseNet = pricing?.uvpNet ?? pricing?.b2cStoreNet ?? null;
    const baseCurrency = "EUR";

    return {
      productId: params.productId,
      channel: params.channel,
      baseNet,
      baseCurrency,
      competitors: competitors.map((c) => ({
        competitor: c.competitor,
        netPrice: c.netPrice ?? null,
        currency: c.currency ?? baseCurrency,
        url: c.url ?? undefined,
      })),
    };
  }

  async createPriceDraft(params: {
    productId: string;
    channel: string;
    newNet: number;
    createdByUserId: string;
    notes?: string | undefined;
  }): Promise<{ draftId: string }> {
    const draft = await this.prisma.productPriceDraft.create({
      data: {
        productId: params.productId,
        channel: params.channel,
        newNet: params.newNet,
        notes: params.notes ?? null,
      },
      select: { id: true },
    });
    return { draftId: draft.id };
  }

  async approvePriceDraft(params: {
    draftId: string;
    approvedByUserId: string;
  }): Promise<{ productId: string; applied: boolean }> {
    const draft = await this.prisma.productPriceDraft.findUnique({
      where: { id: params.draftId },
    });
    if (!draft) {
      return { productId: "", applied: false };
    }

    await this.prisma.productPricing.upsert({
      where: { productId: draft.productId },
      update: { uvpNet: draft.newNet, updatedAt: new Date() },
      create: {
        productId: draft.productId,
        uvpNet: draft.newNet,
      },
    });

    return { productId: draft.productId, applied: true };
  }

  async recordPricingHistory(params: {
    productId: string;
    channel: string;
    oldNet?: number | null | undefined;
    newNet?: number | null | undefined;
    marginBefore?: number | null | undefined;
    marginAfter?: number | null | undefined;
    meta?: Record<string, unknown> | undefined;
  }): Promise<void> {
    await this.prisma.aIPricingHistory.create({
      data: {
        productId: params.productId,
        channel: params.channel,
        oldNet: params.oldNet ?? null,
        newNet: params.newNet ?? null,
        marginBefore: params.marginBefore ?? null,
        marginAfter: params.marginAfter ?? null,
        createdAt: new Date(),
      },
    });
  }

  async recordLearningSignal(params: {
    productId: string;
    channel: string;
    period: string;
    salesChangePct?: number | undefined;
    stockChangePct?: number | undefined;
    notes?: string | undefined;
  }): Promise<void> {
    await this.prisma.aILearningJournal.create({
      data: {
        productId: params.productId,
        channel: params.channel,
        eventType: "PERIOD",
        value: params.salesChangePct ?? null,
        notes: params.notes ?? null,
        createdAt: new Date(),
        inputData: {
          period: params.period,
          salesChangePct: params.salesChangePct,
          stockChangePct: params.stockChangePct,
        },
      },
    });
  }
}
