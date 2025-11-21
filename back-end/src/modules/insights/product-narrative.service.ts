import { getProductHeatmap } from "./product-heatmap.service.js";
import { forecastProductPricing } from "./product-forecast.service.js";
import type { ChannelKey } from "./product-heatmap.service.js";

export type NarrativeReport = {
  productId: string;
  productName: string;
  primaryChannel: ChannelKey | null;
  summary: string;
  risks: string[];
  opportunities: string[];
  recommendations: string[];
};

export async function buildProductNarrative(params: {
  productId: string;
  primaryChannel?: ChannelKey;
  scenarioPct?: number;
}): Promise<NarrativeReport | null> {
  const { productId } = params;
  const primaryChannel = params.primaryChannel ?? "B2C";
  const scenarioPct = params.scenarioPct ?? 5;

  const heatmap = await getProductHeatmap(productId);
  if (!heatmap) return null;

  const forecast = await forecastProductPricing({
    productId,
    scenarioPct,
    channel: primaryChannel,
  });

  const risks: string[] = [];
  const opportunities: string[] = [];
  const recommendations: string[] = [];

  // 1) تحليل القنوات الخطرة
  if (heatmap.summary.risky.length > 0) {
    risks.push(
      `Weak profitability on channels: ${heatmap.summary.risky.join(", ")}.`
    );
  }

  if (heatmap.summary.healthy.length > 0) {
    opportunities.push(
      `Strong margins on: ${heatmap.summary.healthy.join(
        ", "
      )}. Protect these positions.`
    );
  }

  // 2) تحليل القناة الأساسية (مثلاً B2C)
  const primaryCell = heatmap.channels.find(
    (c) => c.channel === primaryChannel
  );

  if (primaryCell?.marginPct != null) {
    if (primaryCell.marginPct < 25) {
      risks.push(
        `Primary channel ${primaryChannel} margin is low (${primaryCell.marginPct.toFixed(
          1
        )}%).`
      );
      recommendations.push(
        `Consider increasing ${primaryChannel} price gradually and monitor volume.`
      );
    } else if (primaryCell.marginPct > 50) {
      opportunities.push(
        `Premium margin on ${primaryChannel} (${primaryCell.marginPct.toFixed(
          1
        )}%).`
      );
      recommendations.push(
        `You can use ${primaryChannel} for strategic promotions without killing profitability.`
      );
    }
  }

  // 3) قراءة forecast
  const f = forecast?.results[0];
  if (f && f.newMarginPct != null) {
    const dir = f.priceChangePct >= 0 ? "increase" : "decrease";
    const sign = f.priceChangePct >= 0 ? "+" : "";
    recommendations.push(
      `Scenario: ${sign}${f.priceChangePct}% ${dir} on ${f.channel} → margin moves from ` +
        `${f.baseMarginPct?.toFixed(1) ?? "?"}% to ${f.newMarginPct.toFixed(
          1
        )}%.`
    );

    if (f.estimatedDemandChangePct != null) {
      opportunities.push(
        `Estimated demand change ≈ ${f.estimatedDemandChangePct.toFixed(
          1
        )}%.`
      );
    }
  }

  const summary = [
    `Product "${heatmap.productName}" has ${
      heatmap.summary.healthy.length
    } strong channels and ${
      heatmap.summary.risky.length
    } weak channels from a profitability perspective.`,
    primaryCell?.marginPct != null
      ? `Primary channel ${primaryChannel} operates at ~${primaryCell.marginPct.toFixed(
          1
        )}% margin.`
      : `Primary channel ${primaryChannel} has incomplete pricing data.`,
  ].join(" ");

  return {
    productId: heatmap.productId,
    productName: heatmap.productName,
    primaryChannel,
    summary,
    risks,
    opportunities,
    recommendations,
  };
}
