import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class PricingSimulateDto {
  @ApiPropertyOptional({ description: "Channel to simulate", example: "B2C" })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ description: "New net price", example: 22.5 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined ? Number(value) : undefined
  )
  @IsNumber()
  newNetPrice?: number;

  @ApiPropertyOptional({ description: "Target margin percent", example: 30 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined ? Number(value) : undefined
  )
  @IsNumber()
  targetMarginPct?: number;
}
