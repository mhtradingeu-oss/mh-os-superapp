export interface PricingSnapshotDTO {
  productId: string;
  channel: string;
  net: number | null;
  gross: number | null;
  marginPct: number | null;
  currency: string;
  components: {
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
  };
}

export interface PricingSimulationResultDTO {
  newNet: number;
  newGross: number | null;
  newMarginPct: number | null;
  notes?: string;
}

export interface PricingAdviceDTO {
  aiScore: number;
  evaluation: string;
  risks: string[];
  opportunities: string[];
  suggestions: string[];
}

export interface CompetitorComparisonDTO {
  productId: string;
  channel?: string;
  baseNet: number | null;
  baseCurrency: string;
  competitors: Array<{
    competitor: string;
    netPrice: number | null;
    currency: string;
    url?: string;
  }>;
  cheapestCompetitor?: string;
  priceGapWarning?: string | null;
}
