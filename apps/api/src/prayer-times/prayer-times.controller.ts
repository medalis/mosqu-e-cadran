import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Put, Query, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { type IqamaRule, IqamaRuleSchema, IqamaRulesSchema, type JumuaSlot, JumuaSlotSchema, PRAYERS, type PrayerConfig, PrayerConfigSchema, type SpecialPrayer, SpecialPrayerSchema, TIMES } from "@nidaa/shared";
import { PrayerTimesService } from "./prayer-times.service";
import { PrayerDayService, isoDateShift, isoDateShiftFrom } from "./prayer-day.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MosqueRoleGuard } from "../auth/guards/mosque-role.guard";
import { zodBody } from "../common/zod-validation.pipe";
import { CurrentUser, type AuthUser } from "../common/decorators";
import { AdminMutationInterceptor } from "../common/admin-mutation.interceptor";

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const PreviewBody = z.object({ config: PrayerConfigSchema.optional(), iqamaRules: z.array(IqamaRuleSchema).optional(), from: ISO_DATE.optional(), days: z.number().int().min(1).max(31).optional() });
const ImportBody = z.object({ csv: z.string().min(1), fileName: z.string().max(200).optional() });
const OverrideBody = z.object({
  times: z.object(Object.fromEntries(TIMES.map((t) => [t, HHMM.optional()])) as Record<(typeof TIMES)[number], z.ZodOptional<typeof HHMM>>).partial().optional(),
  iqama: z.object(Object.fromEntries(PRAYERS.map((t) => [t, HHMM.optional()])) as Record<(typeof PRAYERS)[number], z.ZodOptional<typeof HHMM>>).partial().optional(),
}).refine((b) => b.times || b.iqama, { message: "times ou iqama requis" });

@ApiTags("admin")
@ApiBearerAuth("jwt")
@Controller("admin/mosques/:id")
@UseGuards(JwtAuthGuard, MosqueRoleGuard)
@UseInterceptors(AdminMutationInterceptor)
export class PrayerTimesController {
  constructor(private readonly svc: PrayerTimesService, private readonly days: PrayerDayService) {}

  @Get("prayer-config") getConfig(@Param("id") id: string) { return this.svc.getConfig(id); }
  @Put("prayer-config") putConfig(@Param("id") id: string, @Body(zodBody(PrayerConfigSchema)) body: PrayerConfig) { return this.svc.putConfig(id, body); }

  @Post("prayer-config/preview")
  @HttpCode(200)
  preview(@Param("id") id: string, @Body(zodBody(PreviewBody)) body: z.infer<typeof PreviewBody>) {
    return this.days.preview(id, body);
  }

  @Get("iqama-rules") getIqama(@Param("id") id: string) { return this.svc.getIqamaRules(id); }
  @Put("iqama-rules") putIqama(@Param("id") id: string, @Body(zodBody(IqamaRulesSchema)) body: IqamaRule[]) { return this.svc.putIqamaRules(id, body); }

  @Get("jumua") getJumua(@Param("id") id: string) { return this.svc.getJumua(id); }
  @Put("jumua") putJumua(@Param("id") id: string, @Body(zodBody(z.array(JumuaSlotSchema).max(6))) body: JumuaSlot[]) { return this.svc.putJumua(id, body); }

  @Get("special-prayers") listSpecial(@Param("id") id: string) { return this.svc.listSpecial(id); }
  @Post("special-prayers") createSpecial(@Param("id") id: string, @Body(zodBody(SpecialPrayerSchema)) body: SpecialPrayer) { return this.svc.createSpecial(id, body); }
  @Patch("special-prayers/:spId") updateSpecial(@Param("id") id: string, @Param("spId") spId: string, @Body(zodBody(SpecialPrayerSchema.partial())) body: Partial<SpecialPrayer>) { return this.svc.updateSpecial(id, spId, body); }
  @Delete("special-prayers/:spId") @HttpCode(204) async deleteSpecial(@Param("id") id: string, @Param("spId") spId: string) { await this.svc.deleteSpecial(id, spId); }

  @Post("calendar/import")
  importCalendar(@Param("id") id: string, @CurrentUser() user: AuthUser, @Body(zodBody(ImportBody)) body: z.infer<typeof ImportBody>) {
    return this.svc.importCsv(id, user.id, body.csv, body.fileName);
  }

  @Get("calendar/template")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="calendrier-modele.csv"')
  template(@Param("id") id: string) {
    return this.svc.csvTemplate(id);
  }

  @Get("prayer-days")
  async prayerDays(@Param("id") id: string, @Query("from") from?: string, @Query("to") to?: string) {
    const ctx = await this.days.loadContext(id);
    const f = from ?? isoDateShift(ctx.mosque.timezone, 0);
    const t = to ?? isoDateShiftFrom(f, 30);
    this.days.assertIsoDate(f); this.days.assertIsoDate(t);
    if (t < f) throw new BadRequestException("to doit être ≥ from");
    return this.days.range(id, f, t);
  }

  @Patch("prayer-days/:date")
  overrideDay(@Param("id") id: string, @Param("date") date: string, @Body(zodBody(OverrideBody)) body: z.infer<typeof OverrideBody>) {
    this.days.assertIsoDate(date);
    return this.days.override(id, date, body);
  }

  @Delete("prayer-days/:date/override")
  clearOverride(@Param("id") id: string, @Param("date") date: string) {
    this.days.assertIsoDate(date);
    return this.days.clearOverride(id, date);
  }
}
