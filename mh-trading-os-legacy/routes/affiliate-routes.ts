import { Router } from "express";
import { affiliateService } from "../lib/affiliate-service";
import { affiliateRepository } from "../lib/affiliate-repository";
import { affiliateAnalyticsService } from "../lib/affiliate-analytics";
import { affiliateAIAgents } from "../lib/affiliate-ai-agents";
import { z } from "zod";

const router = Router();

router.post("/track-click", async (req, res) => {
  try {
    const schema = z.object({
      affiliateID: z.string(),
      ip: z.string().optional(),
      userAgent: z.string().optional(),
      device: z.string().optional(),
      browser: z.string().optional(),
      os: z.string().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
      referralSource: z.string().optional(),
      landingPage: z.string().optional(),
      queryParams: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const click = await affiliateService.trackClick({
      AffiliateID: data.affiliateID,
      IP: data.ip || req.ip,
      UserAgent: data.userAgent || req.headers['user-agent'],
      Device: data.device,
      Browser: data.browser,
      OS: data.os,
      Country: data.country,
      City: data.city,
      ReferralSource: data.referralSource,
      LandingPage: data.landingPage,
      QueryParams: data.queryParams,
    });

    res.json({ success: true, clickID: click.ClickID });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/record-conversion", async (req, res) => {
  try {
    const schema = z.object({
      affiliateID: z.string(),
      clickID: z.string().optional(),
      orderID: z.string(),
      revenue: z.number(),
      commission: z.number(),
      commissionPct: z.number(),
      productsSold: z.string(),
      customerID: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const conversion = await affiliateService.recordConversion({
      AffiliateID: data.affiliateID,
      ClickID: data.clickID,
      OrderID: data.orderID,
      Revenue: data.revenue,
      Commission: data.commission,
      CommissionPct: data.commissionPct,
      ProductsSold: data.productsSold,
      CustomerID: data.customerID,
    });

    res.json({ success: true, conversionID: conversion.ConversionID });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/affiliates", async (req, res) => {
  try {
    const affiliates = await affiliateService.getAllAffiliates();
    res.json(affiliates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/affiliates/:id", async (req, res) => {
  try {
    const affiliate = await affiliateService.getAffiliateById(req.params.id);
    if (!affiliate) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }
    res.json(affiliate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/affiliates", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string(),
      email: z.string().email(),
      website: z.string().optional(),
      socialMedia: z.string().optional(),
      niche: z.string().optional(),
      commissionPct: z.number().optional(),
    });

    const data = schema.parse(req.body);

    const affiliate = await affiliateService.createAffiliate({
      Name: data.name,
      Email: data.email,
      Website: data.website,
      SocialMedia: data.socialMedia,
      Niche: data.niche,
      CommissionPct: data.commissionPct,
    });

    res.json(affiliate);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/affiliates/:id", async (req, res) => {
  try {
    const affiliate = await affiliateService.updateAffiliate(req.params.id, req.body);
    if (!affiliate) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }
    res.json(affiliate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/candidates", async (req, res) => {
  try {
    const candidates = await affiliateService.getAllCandidates();
    res.json(candidates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/candidates", async (req, res) => {
  try {
    const candidate = await affiliateService.createCandidate(req.body);
    res.json(candidate);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/candidates/:id", async (req, res) => {
  try {
    const candidate = await affiliateService.updateCandidate(req.params.id, req.body);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.json(candidate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics", async (req, res) => {
  try {
    const dateRange = req.query.start && req.query.end
      ? { start: req.query.start as string, end: req.query.end as string }
      : undefined;

    const analytics = await affiliateAnalyticsService.getOverallAnalytics(dateRange);
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics/performance", async (req, res) => {
  try {
    const performance = await affiliateAnalyticsService.getAffiliatePerformance();
    res.json(performance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics/affiliates/:id", async (req, res) => {
  try {
    const analytics = await affiliateAnalyticsService.getAffiliateDetailedAnalytics(req.params.id);
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const dateRange = req.query.start && req.query.end
      ? { start: req.query.start as string, end: req.query.end as string }
      : undefined;

    const summary = await affiliateAnalyticsService.getDashboardSummary(dateRange);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats/timeseries", async (req, res) => {
  try {
    const dateRange = req.query.start && req.query.end
      ? { start: req.query.start as string, end: req.query.end as string }
      : undefined;

    const timeseries = await affiliateAnalyticsService.getTimeseriesStats(dateRange);
    res.json(timeseries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats/sources", async (req, res) => {
  try {
    const dateRange = req.query.start && req.query.end
      ? { start: req.query.start as string, end: req.query.end as string }
      : undefined;

    const sources = await affiliateAnalyticsService.getTrafficSourceStats(dateRange);
    res.json(sources);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/affiliates/:id/ai-insights", async (req, res) => {
  try {
    const insights = await affiliateAnalyticsService.getAffiliateAIInsights(req.params.id);
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/affiliates/:id/fraud-check", async (req, res) => {
  try {
    const fraudCheck = await affiliateAnalyticsService.detectFraud(req.params.id);
    res.json(fraudCheck);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/ai/suggest-niches", async (req, res) => {
  try {
    const niches = await affiliateAIAgents.suggestNiches();
    res.json({ niches });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai/suggest-countries", async (req, res) => {
  try {
    const schema = z.object({
      niches: z.array(z.string()).optional(),
    });

    const { niches } = schema.parse(req.body);
    const countries = await affiliateAIAgents.suggestCountries(niches || []);
    res.json({ countries });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai/suggest-platforms", async (req, res) => {
  try {
    const schema = z.object({
      niches: z.array(z.string()).optional(),
      personTypes: z.array(z.string()).optional(),
    });

    const { niches, personTypes } = schema.parse(req.body);
    const platforms = await affiliateAIAgents.suggestPlatforms(niches || [], personTypes || []);
    res.json({ platforms });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai/discover", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const schema = z.object({
      niches: z.array(z.string()).optional(),
      personTypes: z.array(z.string()).optional(),
      platforms: z.array(z.string()).optional(),
      countries: z.array(z.string()).optional(),
      minFollowers: z.number().optional(),
      minEngagement: z.number().optional(),
      limit: z.number().optional(),
      // Legacy support
      niche: z.string().optional(),
    });

    const data = schema.parse(req.body);

    // Support legacy niche parameter
    const niches = data.niches || (data.niche ? [data.niche] : undefined);

    const params = {
      niches,
      personTypes: data.personTypes,
      platforms: data.platforms,
      countries: data.countries,
      minFollowers: data.minFollowers,
      minEngagement: data.minEngagement,
      limit: data.limit || 10,
    };

    console.log(`[AI Discovery] Starting advanced discovery with params:`, JSON.stringify(params, null, 2));
    const aiCandidates = await affiliateAIAgents.agentDiscovery(params);
    console.log(`[AI Discovery] AI returned ${aiCandidates.length} candidates`);

    if (aiCandidates.length === 0) {
      return res.json({ candidates: [], count: 0 });
    }

    const savedCandidates = [];
    const errors = [];
    
    for (const aiCandidate of aiCandidates) {
      try {
        // Prepare social media links for Notes field
        const socialLinks = [
          aiCandidate.instagram ? `IG:${aiCandidate.instagram}` : null,
          aiCandidate.youtube ? `YT:${aiCandidate.youtube}` : null,
          aiCandidate.tiktok ? `TT:${aiCandidate.tiktok}` : null,
          aiCandidate.twitter ? `TW:${aiCandidate.twitter}` : null,
        ].filter(Boolean).join(' • ');
        
        // Use service layer with legacy field names (service handles validation & mapping to canonical schema)
        // Service maps: ContentType→Platform, Location→Country, Score→AIScore
        const candidateData = {
          Name: aiCandidate.name,
          ContentType: aiCandidate.contentType || aiCandidate.platform || undefined,  // Service maps to Platform
          Followers: aiCandidate.followers,
          EngagementRate: aiCandidate.engagementRate,
          Niche: aiCandidate.niche,
          Location: aiCandidate.location || undefined,        // Service maps to Country
          Score: aiCandidate.relevanceScore,                  // Service maps to AIScore
          Status: 'New' as const,                             // Legacy Status value
          Email: aiCandidate.email || undefined,
          PrivateEmail: aiCandidate.privateEmail || undefined,
          Phone: aiCandidate.phone || undefined,
          Website: aiCandidate.website || aiCandidate.url || aiCandidate.instagram || aiCandidate.youtube || undefined,
          Notes: `AI-discovered${aiCandidate.personType ? ` • Type: ${aiCandidate.personType}` : ''} • ${aiCandidate.contentType || 'influencer'} • ${aiCandidate.location || 'unknown'}${socialLinks ? ` • ${socialLinks}` : ''}`,
        };
        
        // Service validates, maps to canonical, and saves to Google Sheets
        const saved = await affiliateService.createCandidate(candidateData);
        
        // Fetch the canonical candidate from Google Sheets to get actual persisted values
        const canonical = await affiliateRepository.getCandidateById(saved.CandidateID);
        
        if (!canonical) {
          throw new Error(`Failed to fetch saved candidate ${saved.CandidateID}`);
        }
        
        // Enrich legacy response with canonical fields from actual persisted data
        const enrichedCandidate = {
          ...saved,                    // Legacy fields (Score, ContentType, Location, Status: 'New')
          AIScore: canonical.AIScore,  // Canonical AIScore from Google Sheets
          Platform: canonical.Platform, // Canonical Platform from Google Sheets
          Country: canonical.Country,  // Canonical Country from Google Sheets
          Status: saved.Status,        // Keep legacy Status ('New') for backward compatibility
          CanonicalStatus: canonical.Status, // Add separate canonical status field ('new')
        };
        
        savedCandidates.push(enrichedCandidate);
        console.log(`[AI Discovery] ✅ Saved: ${saved.Name} (${saved.CandidateID}) - AIScore: ${canonical.AIScore}`);
      } catch (error: any) {
        const errorMsg = `Failed to save "${aiCandidate.name}": ${error.message}`;
        console.error(`[AI Discovery] ❌ ${errorMsg}`);
        errors.push({ candidate: aiCandidate.name, error: error.message });
      }
    }

    console.log(`[AI Discovery] Results: ${savedCandidates.length}/${aiCandidates.length} saved, ${errors.length} errors`);

    if (savedCandidates.length === 0 && errors.length > 0) {
      // Log failed discovery
      const duration = (Date.now() - startTime) / 1000;
      await affiliateRepository.logDiscovery({
        niches: params.niches,
        personTypes: params.personTypes,
        platforms: params.platforms,
        countries: params.countries,
        minFollowers: params.minFollowers,
        minEngagement: params.minEngagement,
        limit: params.limit,
        resultsCount: 0,
        duration,
        status: 'Error',
        errorMessage: `Failed to save any candidates: ${errors.map(e => e.error).join(', ')}`,
      });
      
      return res.status(500).json({
        error: 'Failed to save any candidates',
        details: errors,
        count: 0
      });
    }

    // Log successful discovery
    const duration = (Date.now() - startTime) / 1000;
    await affiliateRepository.logDiscovery({
      niches: params.niches,
      personTypes: params.personTypes,
      platforms: params.platforms,
      countries: params.countries,
      minFollowers: params.minFollowers,
      minEngagement: params.minEngagement,
      limit: params.limit,
      resultsCount: savedCandidates.length,
      duration,
      status: 'Success',
    });

    res.json({
      candidates: savedCandidates,
      count: savedCandidates.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('[AI Discovery] Fatal error:', error);
    
    // Log failed discovery
    const duration = (Date.now() - startTime) / 1000;
    try {
      await affiliateRepository.logDiscovery({
        niches: [],
        personTypes: [],
        platforms: [],
        countries: [],
        minFollowers: 0,
        minEngagement: 0,
        limit: 10,
        resultsCount: 0,
        duration,
        status: 'Error',
        errorMessage: error.message,
      });
    } catch (logError) {
      console.error('[AI Discovery] Failed to log error:', logError);
    }
    
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai/rank/:candidateID", async (req, res) => {
  try {
    const candidates = await affiliateService.getAllCandidates();
    const candidate = candidates.find(c => c.CandidateID === req.params.candidateID);

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const ranking = await affiliateAIAgents.agentRanking(candidate);
    
    await affiliateService.updateCandidate(candidate.CandidateID, {
      Score: ranking.score,
    });

    res.json(ranking);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai/outreach/:candidateID", async (req, res) => {
  try {
    const candidates = await affiliateService.getAllCandidates();
    const candidate = candidates.find(c => c.CandidateID === req.params.candidateID);

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const offerDetails = req.body.offerDetails;
    const emailResult = await affiliateAIAgents.agentOutreach(candidate, offerDetails);

    await affiliateService.createOutreachMessage({
      CandidateID: candidate.CandidateID,
      Subject: emailResult.subject,
      Body: emailResult.body,
      EmailTo: candidate.Email || '',
      Status: 'Draft',
    });

    res.json(emailResult);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai/optimize-deal/:id", async (req, res) => {
  try {
    const type = req.body.type || 'candidate';
    
    let profile;
    if (type === 'affiliate') {
      profile = await affiliateService.getAffiliateById(req.params.id);
    } else {
      const candidates = await affiliateService.getAllCandidates();
      profile = candidates.find(c => c.CandidateID === req.params.id);
    }

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const deal = await affiliateAIAgents.agentDealOptimizer(profile);
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai/automate", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string(),
      email: z.string().email(),
      niche: z.string(),
      followers: z.number(),
      website: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const result = await affiliateAIAgents.agentAutomation(data);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/outreach-messages", async (req, res) => {
  try {
    const messages = await affiliateService.getOutreachMessages();
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/outreach-messages", async (req, res) => {
  try {
    const message = await affiliateService.createOutreachMessage(req.body);
    res.json(message);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/tasks", async (req, res) => {
  try {
    const filters = {
      affiliateID: req.query.affiliateID as string | undefined,
      candidateID: req.query.candidateID as string | undefined,
      status: req.query.status as string | undefined,
    };

    const tasks = await affiliateService.getTasks(filters);
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const task = await affiliateService.createTask(req.body);
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const task = await affiliateService.updateTask(req.params.id, req.body);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const dateRange = req.query.start && req.query.end
      ? { start: req.query.start as string, end: req.query.end as string }
      : undefined;

    const summary = await affiliateAnalyticsService.getDashboardSummary(dateRange);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats/timeseries", async (req, res) => {
  try {
    const dateRange = req.query.start && req.query.end
      ? { start: req.query.start as string, end: req.query.end as string }
      : undefined;

    const timeseries = await affiliateAnalyticsService.getTimeseriesStats(dateRange);
    res.json(timeseries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats/sources", async (req, res) => {
  try {
    const dateRange = req.query.start && req.query.end
      ? { start: req.query.start as string, end: req.query.end as string }
      : undefined;

    const sources = await affiliateAnalyticsService.getTrafficSourceStats(dateRange);
    res.json(sources);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/affiliates/:id/ai-insights", async (req, res) => {
  try {
    const insights = await affiliateAnalyticsService.getAffiliateAIInsights(req.params.id);
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
