import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { PricingDomain, ProductDomain } from "@mh-superapp/domain";
import { ProductService } from "./product.service.js";
import { ProductImportDto } from "./dto/product.import.dto.js";
import { ProductQueryDto } from "./dto/product.query.dto.js";

@ApiTags("products")
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller("products")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: "List products with filters" })
  @ApiOkResponse({ description: "Product list", type: Object })
  async list(@Query() query: ProductQueryDto): Promise<ProductDomain.ProductListResult> {
    return this.productService.listProducts(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get product by ID" })
  @ApiParam({ name: "id", description: "Product ID" })
  @ApiOkResponse({ description: "Product", type: Object })
  @ApiBadRequestResponse({ description: "Product not found" })
  async getById(@Param("id") id: string): Promise<ProductDomain.ProductDTO | null> {
    return this.productService.getProduct({ id });
  }

  @Get("sku/:sku")
  @ApiOperation({ summary: "Get product by SKU" })
  @ApiParam({ name: "sku", description: "Product SKU" })
  @ApiOkResponse({ description: "Product", type: Object })
  async getBySku(@Param("sku") sku: string): Promise<ProductDomain.ProductDTO | null> {
    return this.productService.getProduct({ sku });
  }

  @Post("import")
  @ApiOperation({ summary: "Import or upsert a product" })
  @ApiOkResponse({ description: "Import result", type: Object })
  async importProduct(@Body() body: ProductImportDto): Promise<{ productId: string }> {
    return this.productService.importProduct(body);
  }

  @Get(":id/pricing")
  @ApiOperation({ summary: "Get product with pricing snapshot" })
  @ApiParam({ name: "id", description: "Product ID" })
  @ApiOkResponse({ description: "Product + pricing", type: Object })
  async getProductPricing(
    @Param("id") id: string
  ): Promise<{ product: ProductDomain.ProductDTO | null; pricing: PricingDomain.PricingSnapshotDTO | null }> {
    return this.productService.getProductWithPricing({ id });
  }
}
