import prisma from "@src/core/prisma.js";

/**
 * Save a price draft into ProductPriceDraft table.
 * Ensures productId exists to avoid foreign key errors.
 * Prevents duplicate drafts for same product/channel in same day.
 */
export async function savePriceDraft(data: {
  productId: string;
  channel: string;
  oldNet?: number | null;
  oldGross?: number | null;
  oldMargin?: number | null;
  newNet?: number | null;
  newGross?: number | null;
  newMargin?: number | null;
  changePct?: number | null;
  notes?: string | null;
}) {
  try {
    // -------------------------------------
    // 1) Validate product exists
    // -------------------------------------
    const product = await prisma.brandProduct.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      console.error(`❌ savePriceDraft: Invalid productId=${data.productId}`);
      throw new Error(
        `Product not found. Cannot create draft for productId=${data.productId}`
      );
    }

    // -------------------------------------
    // 2) Normalize channel
    // -------------------------------------
    const channel = (data.channel || "").trim().toUpperCase();

    if (!channel) {
      throw new Error("Channel is required when creating a pricing draft.");
    }

    // -------------------------------------
    // 3) Prevent duplicate drafts for same product + channel (same day)
    // -------------------------------------
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingDraft = await prisma.productPriceDraft.findFirst({
      where: {
        productId: data.productId,
        channel: channel,
        createdAt: {
          gte: today,
        },
      },
    });

    if (existingDraft) {
      console.warn(
        `⚠️ Draft already exists today for product ${product.name} (${channel}) — skipping duplicate.`
      );

      return {
        status: "skipped",
        reason: "duplicate_draft_same_day",
        draftId: existingDraft.id,
      };
    }

    // -------------------------------------
    // 4) Insert new draft
    // -------------------------------------
    const draft = await prisma.productPriceDraft.create({
      data: {
        productId: data.productId,
        channel,
        oldNet: data.oldNet ?? null,
        oldGross: data.oldGross ?? null,
        oldMargin: data.oldMargin ?? null,
        newNet: data.newNet ?? null,
        newGross: data.newGross ?? null,
        newMargin: data.newMargin ?? null,
        changePct: data.changePct ?? null,
        notes: data.notes ?? null,
      },
    });

    console.log(
      `📝 Draft created >>> Product: ${product.name} | Channel: ${channel} | DraftID: ${draft.id}`
    );

    return {
      status: "success",
      draftId: draft.id,
      productId: data.productId,
      channel,
    };

  } catch (err) {
    console.error("❌ Save draft error:", err);
    throw err;
  }
}
