export interface ProductDTO {
  id: string;
  brandId: string;
  categoryId?: string | null;
  name: string;
  slug: string;
  sku: string;
  status?: string | null;
  line?: string | null;
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductListFilters {
  search?: string;
  brandId?: string;
  categoryId?: string;
  status?: string;
  channel?: string;
  page?: number;
  pageSize?: number;
}

export interface ProductListResult {
  items: ProductDTO[];
  total: number;
  page: number;
  pageSize: number;
}
