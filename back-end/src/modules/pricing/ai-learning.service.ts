import prisma from "@src/core/prisma.js";

export type PricingOutcomeInput = {
  productId: string;
  channel: string;
  mode?: string;

  oldNet?: number | null;
  newNet?: number | null;

  recommendedPct?: number | null;
  appliedPct?: number | null;

  aiScore?: number | null;

  marginBefore?: number | null;
  marginAfter?: number | null;

  competitorBefore?: number | null;
  competitorAfter?: number | null;

  stockBefore?: number | null;
  stockAfter?: number | null;

  demandBefore?: number | null;
  demandAfter?: number | null;
};

/**
 * 🧠 يسجل نتيجة تعديل السعر في AIPricingHistory + LearningJournal
 */
export async function recordPricingOutcome(input: PricingOutcomeInput) {
  const {
    productId,
    channel,
    mode = "BALANCED",
    oldNet,
    newNet,
    recommendedPct,
    appliedPct,
    aiScore,
    marginBefore,
    marginAfter,
    competitorBefore,
    competitorAfter,
    stockBefore,
    stockAfter,
    demandBefore,
    demandAfter,
  } = input;

  let salesChangePct: number | null = null;
  if (
    typeof demandBefore === "number" &&
    typeof demandAfter === "number" &&
    demandBefore > 0
  ) {
    salesChangePct = ((demandAfter - demandBefore) / demandBefore) * 100;
  }

  // 🔹 سجل السجل الرئيسي
  const history = await prisma.aIPricingHistory.create({
    data: {
      productId,
      channel,
      mode,
      oldNet: oldNet ?? null,
      newNet: newNet ?? null,
      recommendedPct: recommendedPct ?? null,
      appliedPct: appliedPct ?? null,
      aiScore: aiScore ?? null,
      marginBefore: marginBefore ?? null,
      marginAfter: marginAfter ?? null,
      competitorBefore: competitorBefore ?? null,
      competitorAfter: competitorAfter ?? null,
      stockBefore: stockBefore ?? null,
      stockAfter: stockAfter ?? null,
      demandBefore: demandBefore ?? null,
      demandAfter: demandAfter ?? null,
      salesChangePct: salesChangePct ?? null,
    },
  });

  // 🔹 إشارات تعلم (Learning Signals)
  const journalEntries: {
    signal: string;
    value?: number | null;
    notes?: string | null;
  }[] = [];

  if (salesChangePct !== null) {
    if (salesChangePct > 10) {
      journalEntries.push({
        signal: "SALES_UP_AFTER_CHANGE",
        value: salesChangePct,
        notes: "Sales increased after price change.",
      });
    } else if (salesChangePct < -10) {
      journalEntries.push({
        signal: "SALES_DOWN_AFTER_CHANGE",
        value: salesChangePct,
        notes: "Sales dropped after price change.",
      });
    }
  }

  if (
    typeof marginBefore === "number" &&
    typeof marginAfter === "number" &&
    marginAfter > marginBefore + 3
  ) {
    journalEntries.push({
      signal: "MARGIN_IMPROVED",
      value: marginAfter - marginBefore,
      notes: "Margin improved post-pricing.",
    });
  }

  if (
    typeof marginBefore === "number" &&
    typeof marginAfter === "number" &&
    marginAfter < marginBefore - 3
  ) {
    journalEntries.push({
      signal: "MARGIN_DEGRADED",
      value: marginAfter - marginBefore,
      notes: "Margin worsened after change.",
    });
  }

  // اكتب الإشارات في AILearningJournal
  if (journalEntries.length > 0) {
    await prisma.aILearningJournal.createMany({
      data: journalEntries.map((j) => ({
        productId,
        channel,
        signal: j.signal,
        value: j.value ?? null,
        notes: j.notes ?? null,
      })),
    });
  }

  // 🔹 حدّث الأوزان بناءً على النتيجة
  await adjustWeightsFromHistory(mode);

  return history;
}

/**
 * يحصل أو ينشئ وزن AI خاص بالـ mode
 */
async function getOrCreateWeights(mode: string) {
  const normalizedMode = mode.toUpperCase();

  let weights = await prisma.aIPricingWeights.findUnique({
    where: { mode: normalizedMode },
  });

  if (!weights) {
    weights = await prisma.aIPricingWeights.create({
      data: {
        mode: normalizedMode,
        marginWeight: 0.3,
        costWeight: 0.25,
        competitorWeight: 0.3,
        stockWeight: 0.15,
      },
    });
  }

  return weights;
}

/**
 * 🔁 AI Learning Loop – تعديل الأوزان من آخر الهيستوري
 */
export async function adjustWeightsFromHistory(mode: string) {
  const normalizedMode = mode.toUpperCase();

  const [weights, recent] = await Promise.all([
    getOrCreateWeights(normalizedMode),
    prisma.aIPricingHistory.findMany({
      where: { mode: normalizedMode },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (recent.length === 0) return;

  const avgSalesChange =
    recent.reduce(
      (sum, r) => sum + (r.salesChangePct ?? 0),
      0
    ) / recent.length;

  // تأثير بسيط جداً (stable)
  const impact = Math.max(-0.05, Math.min(0.05, avgSalesChange / 200));

  let { marginWeight, costWeight, competitorWeight, stockWeight } = weights;

  if (avgSalesChange > 5) {
    // تسعير ناجح → نعتمد أكثر على المنافسين والمخزون
    competitorWeight += impact;
    stockWeight += impact / 2;
  } else if (avgSalesChange < -5) {
    // تسعير سيء → نعتمد أكثر على المارجن و الكوست
    marginWeight += impact;
    costWeight += impact / 2;
  }

  // حدود منطقية
  function clamp(x: number) {
    return Math.max(0.05, Math.min(0.7, x));
  }

  marginWeight = clamp(marginWeight);
  costWeight = clamp(costWeight);
  competitorWeight = clamp(competitorWeight);
  stockWeight = clamp(stockWeight);

  // نطبع للتتبع
  console.log(
    `📊 AI Weights Updated [${normalizedMode}] → M:${marginWeight.toFixed(
      2
    )} C:${costWeight.toFixed(2)} K:${competitorWeight.toFixed(
      2
    )} S:${stockWeight.toFixed(2)} (avgSalesChange=${avgSalesChange.toFixed(
      2
    )}%)`
  );

  await prisma.aIPricingWeights.update({
    where: { mode: normalizedMode },
    data: {
      marginWeight,
      costWeight,
      competitorWeight,
      stockWeight,
      lastUpdated: new Date(),
    },
  });
}

/**
 * يمكن تنفيذه كرون يومي مستقبلاً
 */
export async function runDailyLearningLoop() {
  const modes = ["SAFE", "BALANCED", "AGGRESSIVE"];

  for (const mode of modes) {
    await adjustWeightsFromHistory(mode);
  }

  console.log("✅ Daily AI Learning Loop executed.");
}
