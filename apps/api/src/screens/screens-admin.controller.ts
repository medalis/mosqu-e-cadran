import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { type ScreenSettings, ScreenSettingsSchema } from "@nidaa/shared";
import { ScreensService } from "./screens.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MosqueRoleGuard } from "../auth/guards/mosque-role.guard";
import { zodBody } from "../common/zod-validation.pipe";
import { Roles } from "../common/decorators";
import { AdminMutationInterceptor } from "../common/admin-mutation.interceptor";

const ClaimBody = z.object({ code: z.string().min(4).max(12), name: z.string().max(80).optional() });

@ApiTags("admin")
@ApiBearerAuth("jwt")
@Controller("admin/mosques/:id")
@UseGuards(JwtAuthGuard, MosqueRoleGuard)
@UseInterceptors(AdminMutationInterceptor)
export class ScreensAdminController {
  constructor(private readonly svc: ScreensService) {}

  @Get("screen-settings") getSettings(@Param("id") id: string) { return this.svc.getSettings(id); }
  @Put("screen-settings") putSettings(@Param("id") id: string, @Body(zodBody(ScreenSettingsSchema)) body: ScreenSettings) { return this.svc.putSettings(id, body); }

  @Get("screens") list(@Param("id") id: string) { return this.svc.listDevices(id); }

  @Post("screens/claim")
  @Roles("owner", "admin")
  claim(@Param("id") id: string, @Body(zodBody(ClaimBody)) body: z.infer<typeof ClaimBody>) { return this.svc.claim(id, body.code, body.name); }

  @Delete("screens/:sid")
  @HttpCode(204)
  @Roles("owner", "admin")
  async remove(@Param("id") id: string, @Param("sid") sid: string) { await this.svc.removeDevice(id, sid); }
}
