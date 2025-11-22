import { ProductDTO, ProductListFilters, ProductListResult } from "./product.types.js";

export interface ProductRepositoryPort {
  findByIdOrSku(params: { id?: string; sku?: string }): Promise<ProductDTO | null>;
  list(filters: ProductListFilters): Promise<ProductListResult>;
  upsertFromImport(payload: unknown): Promise<{ productId: string }>;
}
