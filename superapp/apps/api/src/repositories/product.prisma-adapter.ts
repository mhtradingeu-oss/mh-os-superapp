import { Injectable } from "@nestjs/common";
import { ProductDomain } from "@mh-superapp/domain";
import { Prisma } from "@mh-superapp/prisma";
import { PrismaService } from "../prisma/prisma.service.js";

const toProductDTO = (product: {
  id: string;
  brandId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  sku: string | null;
  status: string | null;
  line: string | null;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProductDomain.ProductDTO => ({
  id: product.id,
  brandId: product.brandId,
  categoryId: product.categoryId,
  name: product.name,
  slug: product.slug,
  sku: product.sku ?? "",
  status: product.status,
  line: product.line,
  imageUrl: product.imageUrl,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

@Injectable()
export class ProductRepositoryPrismaAdapter implements ProductDomain.ProductRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdOrSku(params: { id?: string; sku?: string }) {
    const { id, sku } = params;
    if (!id && !sku) return null;

    const product = await this.prisma.brandProduct.findFirst({
      where: {
        OR: [
          id ? { id } : undefined,
          sku ? { sku } : undefined,
        ].filter(Boolean) as Record<string, unknown>[],
      },
    });

    return product ? toProductDTO(product) : null;
  }

  async list(filters: ProductDomain.ProductListFilters): Promise<ProductDomain.ProductListResult> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.BrandProductWhereInput = {
      brandId: filters.brandId,
      categoryId: filters.categoryId,
      status: filters.status,
    };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        { slug: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        { sku: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.brandProduct.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.brandProduct.count({ where }),
    ]);

    return {
      items: items.map(toProductDTO),
      total,
      page,
      pageSize,
    };
  }

  async upsertFromImport(payload: unknown): Promise<{ productId: string }> {
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid import payload");
    }

    const data = payload as Record<string, unknown>;
    const id = typeof data.id === "string" ? data.id : undefined;
    const sku = typeof data.sku === "string" ? data.sku : undefined;
    const name = typeof data.name === "string" ? data.name : undefined;
    const slug = typeof data.slug === "string" ? data.slug : undefined;
    const brandId = typeof data.brandId === "string" ? data.brandId : undefined;

    if (!sku && !id) {
      throw new Error("Import payload must include sku or id");
    }
    if (!name || !slug || !brandId) {
      throw new Error("Import payload missing required fields: name, slug, brandId");
    }

    const product = await this.prisma.brandProduct.upsert({
      where: sku ? { sku } : { id: id ?? "" },
      update: {
        name,
        slug,
        brandId,
        categoryId: (data.categoryId as string | null) ?? null,
        status: (data.status as string | null) ?? null,
        line: (data.line as string | null) ?? null,
        imageUrl: (data.imageUrl as string | null) ?? null,
      },
      create: {
        id,
        name,
        slug,
        sku: sku ?? "",
        brandId,
        categoryId: (data.categoryId as string | null) ?? null,
        status: (data.status as string | null) ?? null,
        line: (data.line as string | null) ?? null,
        imageUrl: (data.imageUrl as string | null) ?? null,
        price: typeof data.price === "number" ? (data.price as number) : 0,
      },
    });

    return { productId: product.id };
  }
}
