import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class ProductQueryDto {
  @ApiPropertyOptional({ description: "Search by name/slug/sku" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: "Channel filter (optional)" })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined ? Number(value) : undefined
  )
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined ? Number(value) : undefined
  )
  @IsInt()
  @Min(1)
  pageSize?: number;
}
