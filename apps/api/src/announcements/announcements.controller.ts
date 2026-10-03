import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { type AnnouncementInput, AnnouncementInputSchema } from "@nidaa/shared";
import { AnnouncementsService } from "./announcements.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MosqueRoleGuard } from "../auth/guards/mosque-role.guard";
import { zodBody } from "../common/zod-validation.pipe";
import { AdminMutationInterceptor } from "../common/admin-mutation.interceptor";

const FlashBody = z.object({ text: z.string().max(300), isActive: z.boolean().default(true) });
const AnnouncementPatch = AnnouncementInputSchema.partial().extend({ position: z.number().int().min(0).optional() });

@ApiTags("admin")
@ApiBearerAuth("jwt")
@Controller("admin/mosques/:id")
@UseGuards(JwtAuthGuard, MosqueRoleGuard)
@UseInterceptors(AdminMutationInterceptor)
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  @Get("announcements") list(@Param("id") id: string) { return this.svc.list(id); }
  @Post("announcements") create(@Param("id") id: string, @Body(zodBody(AnnouncementInputSchema)) body: AnnouncementInput) { return this.svc.create(id, body); }
  @Patch("announcements/:aId") update(@Param("id") id: string, @Param("aId") aId: string, @Body(zodBody(AnnouncementPatch)) body: z.infer<typeof AnnouncementPatch>) { return this.svc.update(id, aId, body); }
  @Delete("announcements/:aId") @HttpCode(204) async remove(@Param("id") id: string, @Param("aId") aId: string) { await this.svc.remove(id, aId); }

  @Get("flash-message") getFlash(@Param("id") id: string) { return this.svc.getFlash(id); }
  @Put("flash-message") putFlash(@Param("id") id: string, @Body(zodBody(FlashBody)) body: z.infer<typeof FlashBody>) { return this.svc.putFlash(id, body); }
}
