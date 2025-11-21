/**
 * Reprice Orchestrator
 * 
 * Handles batch recalculation of all product prices when pricing parameters
 * or product costs change. This ensures consistency across the system.
 */

import { sheetsService } from './sheets';
import { buildHAIROTICMENContext, calculateHAIROTICMENPricingBatch, type HAIROTICMENPriceBreakdown } from './pricing-engine-hairoticmen';
import { nanoid } from 'nanoid';

interface RepriceJob {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  productsProcessed: number;
  productsTotal: number;
  productsSucceeded: number;
  productsFailed: number;
  errors: Array<{ sku: string; error: string }>;
}

// In-memory job tracking with TTL cleanup
const activeJobs = new Map<string, RepriceJob>();
const JOB_TTL_MS = 1000 * 60 * 60; // 1 hour

// Cleanup old jobs periodically
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of activeJobs.entries()) {
    if (job.completedAt && (now - job.completedAt.getTime()) > JOB_TTL_MS) {
      activeJobs.delete(jobId);
    }
  }
}, 1000 * 60 * 15); // Run every 15 minutes

/**
 * Starts a reprice job for all products
 * @param triggeredBy - Who/what triggered the reprice (e.g., "admin", "param_update")
 * @returns Job ID for tracking
 */
export async function startRepriceJob(triggeredBy: string = 'manual'): Promise<string> {
  const jobId = `reprice_${nanoid(12)}`;
  
  // Check for existing running jobs (prevent concurrent repricing)
  const runningJobs = Array.from(activeJobs.values()).filter(
    job => job.status === 'running' || job.status === 'pending'
  );
  
  if (runningJobs.length > 0) {
    throw new Error(`Reprice job already running: ${runningJobs[0].jobId}`);
  }
  
  const job: RepriceJob = {
    jobId,
    status: 'pending',
    productsProcessed: 0,
    productsTotal: 0,
    productsSucceeded: 0,
    productsFailed: 0,
    errors: [],
  };
  
  activeJobs.set(jobId, job);
  
  // Log job start
  await sheetsService.logToSheet(
    'INFO',
    'Reprice',
    `Starting reprice job ${jobId}`,
    `Triggered by: ${triggeredBy}`
  );
  
  // Run job asynchronously (don't await)
  executeRepriceJob(jobId).catch(error => {
    console.error(`Reprice job ${jobId} failed:`, error);
  });
  
  return jobId;
}

/**
 * Gets the status of a reprice job
 */
export function getJobStatus(jobId: string): RepriceJob | null {
  return activeJobs.get(jobId) || null;
}

/**
 * Lists all recent jobs
 */
export function listJobs(limit: number = 10): RepriceJob[] {
  const jobs = Array.from(activeJobs.values())
    .sort((a, b) => {
      const aTime = a.startedAt?.getTime() || 0;
      const bTime = b.startedAt?.getTime() || 0;
      return bTime - aTime;
    })
    .slice(0, limit);
  
  return jobs;
}

/**
 * Executes the actual reprice job with graceful error handling
 */
async function executeRepriceJob(jobId: string): Promise<void> {
  const job = activeJobs.get(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }
  
  try {
    job.status = 'running';
    job.startedAt = new Date();
    
    // 1. Fetch current sheet data using new public API (preserves column order)
    const { headers, rows: dataRows } = await sheetsService.readSheetRaw('FinalPriceList');
    
    if (headers.length === 0) {
      throw new Error('FinalPriceList sheet is empty or missing headers');
    }
    
    job.productsTotal = dataRows.length;
    
    if (dataRows.length === 0) {
      throw new Error('No products found in FinalPriceList');
    }
    
    // 2. Fetch pricing context using typed getters
    const [params, tiers, amazonTiers, dhlMatrix, dhlSurcharges] = await Promise.all([
      sheetsService.getPricingParams(),
      sheetsService.getPartnerTiers(),
      sheetsService.getAmazonSizeTiers(),
      sheetsService.getShippingMatrixDHL(),
      sheetsService.getDHLSurcharges(),
    ]);
    
    // Build pricing context for HAIROTICMEN engine
    const context = buildHAIROTICMENContext(
      params,
      tiers,
      amazonTiers,
      dhlMatrix,
      dhlSurcharges
    );
    
    // 3. Process products row-by-row with graceful error handling
    const updatedRows: string[][] = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      // Convert row array to product object using headers
      const product: any = {};
      headers.forEach((header: string, idx: number) => {
        product[header] = row[idx];
      });
      
      try {
        // Recalculate prices using HAIROTICMEN pricing engine
        const priceBreakdown = calculateHAIROTICMENPricingBatch([product], context)[0];
        
        if (!priceBreakdown) {
          throw new Error('Pricing calculation returned no result');
        }
        
        // Merge calculated prices back into product object
        const updatedProduct = {
          ...product,
          ...priceBreakdown,
        };
        
        // Convert back to row array IN THE EXACT HEADER ORDER
        const updatedRow = headers.map((header: string) => 
          String(updatedProduct[header] ?? '')
        );
        
        updatedRows.push(updatedRow);
        job.productsSucceeded++;
        
      } catch (error: any) {
        // Graceful degradation: keep original row if pricing fails
        updatedRows.push(row);
        job.productsFailed++;
        job.errors.push({
          sku: product.SKU || `Row ${i + 2}`,
          error: error.message,
        });
        console.error(`Error repricing ${product.SKU || `row ${i+2}`}:`, error);
      }
      
      job.productsProcessed++;
      
      // Rate limiting: small delay every 10 products
      if ((i + 1) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // 4. Write ALL updated rows back to sheet using new bulk overwrite API
    // Start at row 2 (skip header), write only data rows
    if (updatedRows.length > 0) {
      await sheetsService.overwriteRows('FinalPriceList', 2, updatedRows);
    }
    
    // 5. Mark job as completed
    job.status = job.productsFailed > 0 ? 'completed' : 'completed';
    job.completedAt = new Date();
    
    const successRate = job.productsTotal > 0
      ? ((job.productsSucceeded / job.productsTotal) * 100).toFixed(1)
      : '0.0';
    
    await sheetsService.logToSheet(
      job.productsFailed > 0 ? 'WARN' : 'INFO',
      'Reprice',
      `Completed reprice job ${jobId}`,
      `Success: ${job.productsSucceeded}/${job.productsTotal} (${successRate}%), Errors: ${job.productsFailed}`
    );
    
    console.log(`✓ Reprice job ${jobId} completed`);
    console.log(`  Succeeded: ${job.productsSucceeded}/${job.productsTotal} (${successRate}%)`);
    console.log(`  Failed: ${job.productsFailed}`);
    
    if (job.errors.length > 0) {
      console.log(`  First 5 errors:`);
      job.errors.slice(0, 5).forEach(({ sku, error }) => {
        console.log(`    - ${sku}: ${error}`);
      });
    }
    
  } catch (error: any) {
    job.status = 'failed';
    job.completedAt = new Date();
    job.errors.push({
      sku: 'SYSTEM',
      error: `Fatal error: ${error.message}`,
    });
    
    await sheetsService.logToSheet(
      'ERROR',
      'Reprice',
      `Failed reprice job ${jobId}`,
      error.message
    );
    
    console.error(`✗ Reprice job ${jobId} failed:`, error);
    throw error;
  }
}
