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
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { PricingDomain } from "@mh-superapp/domain";
import { PricingService } from "./pricing.service.js";
import { PricingDraftDto } from "./dto/pricing.draft.dto.js";
import { PricingSimulateDto } from "./dto/pricing.simulate.dto.js";

@ApiTags("pricing")
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller("pricing")
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get(":productId/snapshot")
  @ApiOperation({ summary: "Get pricing snapshot for a product" })
  @ApiParam({ name: "productId", description: "Product ID" })
  @ApiOkResponse({ description: "Pricing snapshot", type: Object })
  async getSnapshot(
    @Param("productId") productId: string,
    @Query("channel") channel = "DEFAULT"
  ): Promise<PricingDomain.PricingSnapshotDTO | null> {
    return this.pricingService.getPricingSnapshot({ productId, channel });
  }

  @Get(":productId/simulate")
  @ApiOperation({ summary: "Simulate pricing scenario" })
  @ApiParam({ name: "productId", description: "Product ID" })
  @ApiOkResponse({ description: "Base and simulated pricing", type: Object })
  async simulate(
    @Param("productId") productId: string,
    @Query() query: PricingSimulateDto
  ): Promise<{
    base: PricingDomain.PricingSnapshotDTO | null;
    simulated: PricingDomain.PricingSimulationResultDTO | null;
  }> {
    return this.pricingService.simulateScenario({
      productId,
      channel: query.channel ?? "DEFAULT",
      newNetPrice: query.newNetPrice,
      targetMarginPct: query.targetMarginPct,
    });
  }

  @Post(":productId/draft")
  @ApiOperation({ summary: "Create a price draft" })
  @ApiParam({ name: "productId", description: "Product ID" })
  @ApiBody({ type: PricingDraftDto })
  @ApiOkResponse({ description: "Draft created", type: Object })
  async createDraft(
    @Param("productId") productId: string,
    @Body() body: PricingDraftDto
  ): Promise<{ draftId: string }> {
    return this.pricingService.createPriceDraft({
      productId,
      channel: body.channel,
      newNet: body.newNet,
      createdByUserId: body.createdByUserId,
      notes: body.notes,
    });
  }

  @Post(":productId/approve")
  @ApiOperation({ summary: "Approve a price draft" })
  @ApiParam({ name: "productId", description: "Product ID (for context)" })
  @ApiBody({ schema: { properties: { draftId: { type: "string" }, approvedByUserId: { type: "string" } } } })
  @ApiOkResponse({ description: "Draft approval result", type: Object })
  @ApiBadRequestResponse({ description: "Draft not found" })
  async approveDraft(
    @Param("productId") _productId: string,
    @Body() body: { draftId: string; approvedByUserId: string }
  ): Promise<{ productId: string; applied: boolean }> {
    return this.pricingService.approvePriceDraft({
      draftId: body.draftId,
      approvedByUserId: body.approvedByUserId,
    });
  }

  @Get(":productId/advice")
  @ApiOperation({ summary: "Get pricing advice" })
  @ApiParam({ name: "productId", description: "Product ID" })
  @ApiOkResponse({ description: "Advice", type: Object })
  async getAdvice(
    @Param("productId") productId: string,
    @Query("channel") channel = "DEFAULT"
  ): Promise<PricingDomain.PricingAdviceDTO | null> {
    return this.pricingService.getPricingAdvice({ productId, channel });
  }

  @Get(":productId/competitor")
  @ApiOperation({ summary: "Compare competitor prices" })
  @ApiParam({ name: "productId", description: "Product ID" })
  @ApiOkResponse({ description: "Competitor comparison", type: Object })
  async compareCompetitor(
    @Param("productId") productId: string,
    @Query("channel") channel?: string
  ): Promise<PricingDomain.CompetitorComparisonDTO> {
    return this.pricingService.compareCompetitors({ productId, channel });
  }
}
