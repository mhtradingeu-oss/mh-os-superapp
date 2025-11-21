import OpenAI from "openai";
import pLimit from "p-limit";
import pRetry from "p-retry";
import crypto from "crypto";
import { aiResponseCache, createCacheKey } from "./cache";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

const globalLimit = pLimit(3);

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex').substring(0, 16);
}

export async function batchProcessPrompts(prompts: string[]): Promise<string[]> {
  const limit = pLimit(2);
  
  const processingPromises = prompts.map((prompt) =>
    limit(() =>
      pRetry(
        async () => {
          try {
            const response = await openai.chat.completions.create({
              model: "gpt-4o-mini", // Using gpt-4o-mini for cost optimization (affiliate discovery)
              messages: [{ role: "user", content: prompt }],
              max_completion_tokens: 8192,
            });
            return response.choices[0]?.message?.content || "";
          } catch (error: any) {
            if (isRateLimitError(error)) {
              throw error;
            }
            throw new pRetry.AbortError(error);
          }
        },
        {
          retries: 7,
          minTimeout: 2000,
          maxTimeout: 128000,
          factor: 2,
        }
      )
    )
  );
  
  return await Promise.all(processingPromises);
}

export async function generateAIResponse(prompt: string, useCache: boolean = true): Promise<string> {
  const cacheKey = createCacheKey('ai', 'response', hashPrompt(prompt));
  
  if (!useCache) {
    return globalLimit(async () => {
      try {
        const response = await pRetry(
          async () => {
            const res = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              max_completion_tokens: 8192,
            });
            return res;
          },
          {
            retries: 3,
            minTimeout: 1000,
            maxTimeout: 10000,
            factor: 2,
            onFailedAttempt: (error) => {
              if (isRateLimitError(error)) {
                console.log(`Rate limit hit, retry attempt ${error.attemptNumber}`);
              }
            }
          }
        );
        return response.choices[0]?.message?.content || "";
      } catch (error: any) {
        console.error('OpenAI API error:', error);
        throw new Error(`AI generation failed: ${error.message}`);
      }
    });
  }

  return aiResponseCache.getOrSet(cacheKey, () =>
    globalLimit(async () => {
      try {
        const response = await pRetry(
          async () => {
            const res = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              max_completion_tokens: 8192,
            });
            return res;
          },
          {
            retries: 3,
            minTimeout: 1000,
            maxTimeout: 10000,
            factor: 2,
            onFailedAttempt: (error) => {
              if (isRateLimitError(error)) {
                console.log(`Rate limit hit, retry attempt ${error.attemptNumber}`);
              }
            }
          }
        );
        return response.choices[0]?.message?.content || "";
      } catch (error: any) {
        console.error('OpenAI API error:', error);
        throw new Error(`AI generation failed: ${error.message}`);
      }
    })
  );
}

export async function generateStructuredResponse<T>(
  prompt: string,
  schema: string,
  useCache: boolean = true
): Promise<T> {
  const fullPrompt = `${prompt}\n\nPlease respond with valid JSON matching this schema:\n${schema}`;
  const cacheKey = createCacheKey('ai', 'structured', hashPrompt(fullPrompt));
  
  if (!useCache) {
    return globalLimit(async () => {
      try {
        const response = await pRetry(
          async () => {
            const res = await openai.chat.completions.create({
              model: "gpt-5",
              messages: [{ role: "user", content: fullPrompt }],
              response_format: { type: "json_object" },
              max_completion_tokens: 8192,
            });
            return res;
          },
          {
            retries: 3,
            minTimeout: 1000,
            maxTimeout: 10000,
            factor: 2,
            onFailedAttempt: (error) => {
              if (isRateLimitError(error)) {
                console.log(`Rate limit hit, retry attempt ${error.attemptNumber}`);
              }
            }
          }
        );
        const content = response.choices[0]?.message?.content || "{}";
        return JSON.parse(content) as T;
      } catch (error: any) {
        console.error('OpenAI structured response error:', error);
        throw new Error(`AI generation failed: ${error.message}`);
      }
    });
  }

  return aiResponseCache.getOrSet(cacheKey, () =>
    globalLimit(async () => {
      try {
        const response = await pRetry(
          async () => {
            const res = await openai.chat.completions.create({
              model: "gpt-5",
              messages: [{ role: "user", content: fullPrompt }],
              response_format: { type: "json_object" },
              max_completion_tokens: 8192,
            });
            return res;
          },
          {
            retries: 3,
            minTimeout: 1000,
            maxTimeout: 10000,
            factor: 2,
            onFailedAttempt: (error) => {
              if (isRateLimitError(error)) {
                console.log(`Rate limit hit, retry attempt ${error.attemptNumber}`);
              }
            }
          }
        );
        const content = response.choices[0]?.message?.content || "{}";
        return JSON.parse(content) as T;
      } catch (error: any) {
        console.error('OpenAI structured response error:', error);
        throw new Error(`AI generation failed: ${error.message}`);
      }
    })
  );
}
