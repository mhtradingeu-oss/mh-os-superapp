import { ProductRepositoryPort } from "./product.repository.js";
import { ProductDTO, ProductListFilters, ProductListResult } from "./product.types.js";
import { PricingRepositoryPort } from "../pricing/pricing.repository.js";
import { PricingSnapshotDTO } from "../pricing/pricing.types.js";

export class GetProductByIdOrSkuUseCase {
  constructor(private readonly productRepo: ProductRepositoryPort) {}

  async execute(params: { id?: string; sku?: string }): Promise<ProductDTO | null> {
    return this.productRepo.findByIdOrSku(params);
  }
}

export class ListProductsWithFiltersUseCase {
  constructor(private readonly productRepo: ProductRepositoryPort) {}

  async execute(filters: ProductListFilters): Promise<ProductListResult> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
    return this.productRepo.list({ ...filters, page, pageSize });
  }
}

export class UpsertProductFromImportUseCase {
  constructor(private readonly productRepo: ProductRepositoryPort) {}

  async execute(payload: unknown): Promise<{ productId: string }> {
    if (!payload) {
      throw new Error("Import payload is required");
    }
    return this.productRepo.upsertFromImport(payload);
  }
}

export class GetProductDetailWithPricingUseCase {
  constructor(
    private readonly productRepo: ProductRepositoryPort,
    private readonly pricingRepo: PricingRepositoryPort
  ) {}

  async execute(params: { id?: string; sku?: string }): Promise<{
    product: ProductDTO | null;
    pricing: PricingSnapshotDTO | null;
  }> {
    const product = await this.productRepo.findByIdOrSku(params);
    if (!product) {
      return { product: null, pricing: null };
    }
    const pricing = await this.pricingRepo.getPricingSnapshot({
      productId: product.id,
      channel: "DEFAULT",
    });
    return { product, pricing };
  }
}
