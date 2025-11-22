import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class PricingDraftDto {
  @ApiProperty({ description: "Channel identifier", example: "B2C" })
  @IsString()
  channel!: string;

  @ApiProperty({ description: "New net price", example: 19.99 })
  @IsNumber()
  newNet!: number;

  @ApiProperty({ description: "User ID creating the draft" })
  @IsString()
  createdByUserId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
