import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { MEMBER_ROLES, type MosqueInput, MosqueInputSchema } from "@nidaa/shared";
import { MosquesService } from "./mosques.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MosqueRoleGuard } from "../auth/guards/mosque-role.guard";
import { zodBody } from "../common/zod-validation.pipe";
import { CurrentUser, Roles, type AuthUser } from "../common/decorators";
import { AdminMutationInterceptor } from "../common/admin-mutation.interceptor";

const MemberBody = z.object({ email: z.string().email(), role: z.enum(MEMBER_ROLES) });
const MemberPatch = z.object({ role: z.enum(MEMBER_ROLES) });

@ApiTags("admin")
@ApiBearerAuth("jwt")
@Controller("admin/mosques")
@UseGuards(JwtAuthGuard)
@UseInterceptors(AdminMutationInterceptor)
export class MosquesController {
  constructor(private readonly mosques: MosquesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.mosques.listMine(user.id, user.isSuperAdmin);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(zodBody(MosqueInputSchema)) body: MosqueInput) {
    return this.mosques.create(user.id, body);
  }

  @Get(":id")
  @UseGuards(MosqueRoleGuard)
  get(@Param("id") id: string) {
    return this.mosques.getFull(id);
  }

  @Patch(":id")
  @UseGuards(MosqueRoleGuard)
  @Roles("owner", "admin")
  update(@Param("id") id: string, @Body(zodBody(MosqueInputSchema.partial())) body: Partial<MosqueInput>) {
    return this.mosques.update(id, body);
  }

  @Post(":id/submit")
  @UseGuards(MosqueRoleGuard)
  @Roles("owner", "admin")
  submit(@Param("id") id: string) {
    return this.mosques.submit(id);
  }

  // ----- membres -----
  @Get(":id/members")
  @UseGuards(MosqueRoleGuard)
  members(@Param("id") id: string) {
    return this.mosques.listMembers(id);
  }

  @Post(":id/members")
  @UseGuards(MosqueRoleGuard)
  @Roles("owner", "admin")
  addMember(@Param("id") id: string, @CurrentUser() user: AuthUser, @Body(zodBody(MemberBody)) body: z.infer<typeof MemberBody>) {
    return this.mosques.addMember(id, user.id, body.email, body.role);
  }

  @Patch(":id/members/:mId")
  @UseGuards(MosqueRoleGuard)
  @Roles("owner", "admin")
  updateMember(@Param("id") id: string, @Param("mId") mId: string, @Body(zodBody(MemberPatch)) body: z.infer<typeof MemberPatch>) {
    return this.mosques.updateMember(id, mId, body.role);
  }

  @Delete(":id/members/:mId")
  @HttpCode(204)
  @UseGuards(MosqueRoleGuard)
  @Roles("owner", "admin")
  async removeMember(@Param("id") id: string, @Param("mId") mId: string) {
    await this.mosques.removeMember(id, mId);
  }

  @Get(":id/audit-log")
  @UseGuards(MosqueRoleGuard)
  @Roles("owner", "admin")
  auditLog(@Param("id") id: string, @Query("limit") limit?: string) {
    return this.mosques.auditLog(id, limit ? Number(limit) : 50);
  }
}
