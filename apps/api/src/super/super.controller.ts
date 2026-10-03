import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { MOSQUE_STATUS } from "@nidaa/shared";
import { SuperService } from "./super.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { zodBody } from "../common/zod-validation.pipe";
import { CurrentUser, type AuthUser } from "../common/decorators";
import { AuditService } from "../common/audit.service";

const ContentItemSchema = z.object({
  kind: z.enum(["hadith", "ayah", "dua", "dhikr"]),
  textAr: z.string().min(1).max(2000),
  textFr: z.string().max(2000).nullable().default(null),
  textEn: z.string().max(2000).nullable().default(null),
  reference: z.string().max(200).nullable().default(null),
  context: z.enum(["after_adhan", "after_prayer", "rotation"]),
  isActive: z.boolean().default(true),
});
const RejectBody = z.object({ reason: z.string().min(2).max(500) });

@ApiTags("super")
@ApiBearerAuth("jwt")
@Controller("super")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SuperController {
  constructor(private readonly svc: SuperService, private readonly audit: AuditService) {}

  @Get("mosques")
  mosques(@Query("status") status?: string) {
    if (status && !(MOSQUE_STATUS as readonly string[]).includes(status)) return [];
    return this.svc.listMosques(status);
  }

  @Post("mosques/:id/approve") approve(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.svc.setStatus(id, u.id, "approve"); }
  @Post("mosques/:id/reject") reject(@Param("id") id: string, @CurrentUser() u: AuthUser, @Body(zodBody(RejectBody)) body: z.infer<typeof RejectBody>) { return this.svc.setStatus(id, u.id, "reject", body.reason); }
  @Post("mosques/:id/suspend") suspend(@Param("id") id: string, @CurrentUser() u: AuthUser) { return this.svc.setStatus(id, u.id, "suspend"); }

  @Get("content-items") listContent() { return this.svc.listContent(); }
  @Post("content-items")
  async createContent(@CurrentUser() u: AuthUser, @Body(zodBody(ContentItemSchema)) body: z.infer<typeof ContentItemSchema>) {
    const c = await this.svc.createContent(body);
    await this.audit.log({ actorUserId: u.id, action: "super.content.create", entityType: "content_item", entityId: c.id, diff: body });
    return c;
  }
  @Patch("content-items/:cid")
  async updateContent(@CurrentUser() u: AuthUser, @Param("cid") cid: string, @Body(zodBody(ContentItemSchema.partial())) body: Partial<z.infer<typeof ContentItemSchema>>) {
    const c = await this.svc.updateContent(cid, body);
    await this.audit.log({ actorUserId: u.id, action: "super.content.update", entityType: "content_item", entityId: cid, diff: body });
    return c;
  }
  @Delete("content-items/:cid")
  @HttpCode(204)
  async deleteContent(@CurrentUser() u: AuthUser, @Param("cid") cid: string) {
    await this.svc.deleteContent(cid);
    await this.audit.log({ actorUserId: u.id, action: "super.content.delete", entityType: "content_item", entityId: cid });
  }

  @Get("stats") stats() { return this.svc.stats(); }
}
