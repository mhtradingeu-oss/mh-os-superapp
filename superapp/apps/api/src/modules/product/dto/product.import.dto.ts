import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ProductImportDto {
  @ApiProperty({ description: "Product SKU", example: "SKU-123" })
  @IsString()
  sku!: string;

  @ApiProperty({ description: "Product name" })
  @IsString()
  name!: string;

  @ApiProperty({ description: "Product slug" })
  @IsString()
  slug!: string;

  @ApiProperty({ description: "Brand ID" })
  @IsString()
  brandId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  line?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
