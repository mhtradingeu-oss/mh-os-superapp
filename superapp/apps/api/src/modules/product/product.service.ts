import { Injectable } from "@nestjs/common";
import { PricingDomain, ProductDomain } from "@mh-superapp/domain";
import { PricingRepositoryPrismaAdapter } from "../../repositories/pricing.prisma-adapter.js";
import { ProductRepositoryPrismaAdapter } from "../../repositories/product.prisma-adapter.js";

@Injectable()
export class ProductService {
  private readonly getByIdOrSku: ProductDomain.GetProductByIdOrSkuUseCase;
  private readonly listWithFilters: ProductDomain.ListProductsWithFiltersUseCase;
  private readonly upsertFromImport: ProductDomain.UpsertProductFromImportUseCase;
  private readonly getDetailWithPricing: ProductDomain.GetProductDetailWithPricingUseCase;

  constructor(
    private readonly productRepo: ProductRepositoryPrismaAdapter,
    private readonly pricingRepo: PricingRepositoryPrismaAdapter
  ) {
    this.getByIdOrSku = new ProductDomain.GetProductByIdOrSkuUseCase(productRepo);
    this.listWithFilters = new ProductDomain.ListProductsWithFiltersUseCase(productRepo);
    this.upsertFromImport = new ProductDomain.UpsertProductFromImportUseCase(productRepo);
    this.getDetailWithPricing = new ProductDomain.GetProductDetailWithPricingUseCase(
      productRepo,
      pricingRepo
    );
  }

  async getProduct(params: { id?: string; sku?: string }) {
    return this.getByIdOrSku.execute(params);
  }

  async listProducts(filters: ProductDomain.ProductListFilters) {
    return this.listWithFilters.execute(filters);
  }

  async importProduct(payload: unknown) {
    return this.upsertFromImport.execute(payload);
  }

  async getProductWithPricing(params: { id?: string; sku?: string }) {
    return this.getDetailWithPricing.execute(params);
  }
}
