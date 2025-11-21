import type { BrandProduct } from "@prisma/client";

type ProductWithRelations = BrandProduct & {
  brand?: { name: string; slug: string } | null;
  category?: { name: string; slug: string } | null;
  pricing?: any;
};

type RankedProduct = ProductWithRelations & {
  aiScore?: number;
};

/**
 * 🤖 AI-based ranking using OpenAI Embeddings
 * - يعتمد على OPENAI_API_KEY في .env
 * - لو غير موجود → يرجع نفس النتائج بدون تغيير
 */
export async function rankProductsWithAI(
  query: string,
  products: ProductWithRelations[]
): Promise<RankedProduct[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ OPENAI_API_KEY not set → skipping AI ranking.");
    return products;
  }

  if (!products.length) return products;

  const texts = products.map((p) => {
    const parts = [
      p.name ?? "",
      p.description ?? "",
      p.line ?? "",
      p.sku ?? "",
      p.upc ?? "",
      p.category?.name ?? "",
      p.brand?.name ?? "",
    ];
    return parts.filter(Boolean).join("\n");
  });

  // 🧠 نطلب Embeddings للـ query + كل المنتجات
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: [query, ...texts],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("❌ OpenAI Embeddings error:", errText);
    return products;
  }

  const data = (await res.json()) as {
    data: { embedding: number[] }[];
  };

  const [queryEmbedding, ...productEmbeddings] = data.data;

  // 🧮 نحسب cosine similarity بين query وكل منتج
  const scores = productEmbeddings.map((emb, idx) => {
    const score = cosineSimilarity(queryEmbedding.embedding, emb.embedding);
    return { index: idx, score };
  });

  // 🔢 نرتّب المنتجات بحسب الـ score
  const sorted = scores
    .sort((a, b) => b.score - a.score)
    .map((s) => ({
      ...products[s.index],
      aiScore: s.score,
    }));

  return sorted;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (!normA || !normB) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
