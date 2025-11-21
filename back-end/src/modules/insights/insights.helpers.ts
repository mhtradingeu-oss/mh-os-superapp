export function analyzeProductInsights(product) {
  const pricing = product.pricing;
  const competitors = product.competitorPrices || [];
  const history = product.priceHistory || [];
  const signals = product.learningJournal || [];

  // --- 1) Margin Analysis ---
  const margin = pricing?.b2cStoreNet && pricing?.cogsEur
    ? ((pricing.b2cStoreNet - pricing.cogsEur) / pricing.b2cStoreNet) * 100
    : null;

  let marginHealth = "Unknown";
  if (margin !== null) {
    if (margin < 20) marginHealth = "Critical";
    else if (margin < 30) marginHealth = "Weak";
    else if (margin < 45) marginHealth = "Healthy";
    else marginHealth = "Excellent";
  }

  // --- 2) Competitor Pressure ---
  let competitorPressure = "No Data";
  if (competitors.length > 0) {
    const avgComp = competitors.reduce((sum, c) => sum + (c.price || 0), 0) / competitors.length;
    const gap = pricing.b2cStoreNet - avgComp;

    if (gap > 10) competitorPressure = "Overpriced vs competitors";
    else if (gap < -10) competitorPressure = "Underpriced vs competitors";
    else competitorPressure = "Competitive";
  }

  // --- 3) AI Risks from history ---
  const lastSignals = signals.slice(-5).map((s) => s.signal);

  // --- 4) Opportunity Score ---
  let opportunityScore = 50;
  if (margin !== null && margin > 35) opportunityScore += 10;
  if (competitors.length === 0) opportunityScore += 5;

  // --- Final Insights Object ---
  return {
    margin,
    marginHealth,
    competitorPressure,
    recentSignals: lastSignals,
    opportunityScore,
    recommendedActions: generateRecommendations(margin, competitorPressure),
  };
}

function generateRecommendations(margin, competitorPressure) {
  const actions = [];

  if (margin < 25) actions.push("Increase price gradually (5–10%).");
  if (competitorPressure === "Overpriced vs competitors")
    actions.push("Adjust price to match competitor range.");
  if (competitorPressure === "Underpriced vs competitors")
    actions.push("Opportunity to increase price (+8–15%).");

  if (actions.length === 0) actions.push("Stable pricing — no action needed.");

  return actions;
}
