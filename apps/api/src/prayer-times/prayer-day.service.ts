import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, PrayerDay as PrayerDayRow } from "@prisma/client";
import { HIJRI_MONTHS_AR, HIJRI_MONTHS_FR, type IqamaRule, type Prayer, type PrayerConfig, PrayerConfigSchema, type PrayerDay, type TimeKey } from "@nidaa/shared";
import { resolveDay, resolveIqama, resolveRange, toIsoDate } from "@nidaa/prayer-engine";
import { PrismaService } from "../prisma/prisma.service";
import { pad2 } from "../common/utils";

export const HORIZON_DAYS = 400;

export interface MosqueGeo { id: string; latitude: number; longitude: number; timezone: string }

/** Jour civil "YYYY-MM-DD" décalé de `delta` jours par rapport à aujourd'hui dans le fuseau donné. */
export function isoDateShift(timezone: string, delta: number, from = new Date()): string {
  const today = toIsoDate(from, timezone);
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta, 12));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function rowToDay(r: PrayerDayRow): PrayerDay {
  return {
    date: r.date,
    hijri: { day: r.hijriDay, month: r.hijriMonth, year: r.hijriYear, monthNameAr: HIJRI_MONTHS_AR[r.hijriMonth - 1], monthNameFr: HIJRI_MONTHS_FR[r.hijriMonth - 1] },
    times: { fajr: r.fajr, shuruq: r.shuruq, dhuhr: r.dhuhr, asr: r.asr, maghrib: r.maghrib, isha: r.isha },
    iqama: { fajr: r.iqamaFajr, dhuhr: r.iqamaDhuhr, asr: r.iqamaAsr, maghrib: r.iqamaMaghrib, isha: r.iqamaIsha },
    source: r.source as PrayerDay["source"],
  };
}

export function dayToRow(mosqueId: string, d: PrayerDay): Prisma.PrayerDayCreateManyInput {
  return {
    mosqueId, date: d.date, source: d.source,
    fajr: d.times.fajr, shuruq: d.times.shuruq, dhuhr: d.times.dhuhr, asr: d.times.asr, maghrib: d.times.maghrib, isha: d.times.isha,
    iqamaFajr: d.iqama.fajr, iqamaDhuhr: d.iqama.dhuhr, iqamaAsr: d.iqama.asr, iqamaMaghrib: d.iqama.maghrib, iqamaIsha: d.iqama.isha,
    hijriDay: d.hijri.day, hijriMonth: d.hijri.month, hijriYear: d.hijri.year,
  };
}

@Injectable()
export class PrayerDayService {
  constructor(private readonly prisma: PrismaService) {}

  async loadContext(mosqueId: string): Promise<{ mosque: MosqueGeo; config: PrayerConfig; iqamaRules: IqamaRule[] }> {
    const mosque = await this.prisma.mosque.findUnique({ where: { id: mosqueId }, include: { prayerConfig: true, iqamaRules: true } });
    if (!mosque) throw new NotFoundException("Mosquée introuvable");
    return { mosque, config: this.toConfig(mosque.prayerConfig), iqamaRules: mosque.iqamaRules.map((r) => this.toRule(r)) };
  }

  toConfig(row: Record<string, unknown> | null): PrayerConfig {
    if (!row) return PrayerConfigSchema.parse({});
    const { id: _i, mosqueId: _m, updatedAt: _u, ...rest } = row as Record<string, unknown>;
    return PrayerConfigSchema.parse({ ...rest, adjustments: rest.adjustments ?? {} });
  }

  toRule(r: { prayer: string; mode: string; delayMin: number | null; fixedTime: string | null }): IqamaRule {
    return { prayer: r.prayer as Prayer, mode: r.mode as IqamaRule["mode"], delayMin: r.delayMin, fixedTime: r.fixedTime };
  }

  /**
   * Réécrit 400 jours de prayer_day à partir d'hier.
   *  - jours `override` : jamais touchés (conservés tels quels, y compris leur iqama) ;
   *  - jours `calendar` : horaires conservés, iqama/hégirien recalculés avec les règles courantes ;
   *  - le reste : recalculé, les jours hors fenêtre (non override) sont supprimés.
   */
  async rebuild(mosqueId: string): Promise<number> {
    const { mosque, config, iqamaRules } = await this.loadContext(mosqueId);
    const from = isoDateShift(mosque.timezone, -1);
    const existing = await this.prisma.prayerDay.findMany({ where: { mosqueId, source: { in: ["calendar", "override"] } } });
    const overrides: Record<string, { times: Partial<Record<TimeKey, string>>; source: "calendar" | "override" }> = {};
    const skip = new Set<string>();
    for (const r of existing) {
      if (r.source === "override") skip.add(r.date);
      else overrides[r.date] = { source: "calendar", times: { fajr: r.fajr, shuruq: r.shuruq, dhuhr: r.dhuhr, asr: r.asr, maghrib: r.maghrib, isha: r.isha } };
    }
    const days = resolveRange({ latitude: mosque.latitude, longitude: mosque.longitude, timezone: mosque.timezone, config, iqamaRules }, from, HORIZON_DAYS, overrides).filter((d) => !skip.has(d.date));
    await this.prisma.$transaction([
      this.prisma.prayerDay.deleteMany({ where: { mosqueId, source: { not: "override" } } }),
      this.prisma.prayerDay.createMany({ data: days.map((d) => dayToRow(mosqueId, d)) }),
    ]);
    return days.length;
  }

  /** Aperçu sans écriture. */
  async preview(mosqueId: string, opts: { config?: PrayerConfig; iqamaRules?: IqamaRule[]; from?: string; days?: number }): Promise<PrayerDay[]> {
    const ctx = await this.loadContext(mosqueId);
    const from = opts.from ?? isoDateShift(ctx.mosque.timezone, 0);
    const n = Math.min(Math.max(opts.days ?? 7, 1), 31);
    const existing = await this.prisma.prayerDay.findMany({ where: { mosqueId, source: { in: ["calendar", "override"] }, date: { gte: from, lte: isoDateShiftFrom(from, n) } } });
    const overrides: Record<string, { times: Partial<Record<TimeKey, string>>; source: "calendar" | "override" }> = {};
    for (const r of existing) overrides[r.date] = { source: r.source as "calendar" | "override", times: { fajr: r.fajr, shuruq: r.shuruq, dhuhr: r.dhuhr, asr: r.asr, maghrib: r.maghrib, isha: r.isha } };
    return resolveRange({ latitude: ctx.mosque.latitude, longitude: ctx.mosque.longitude, timezone: ctx.mosque.timezone, config: opts.config ?? ctx.config, iqamaRules: opts.iqamaRules ?? ctx.iqamaRules }, from, n, overrides);
  }

  async range(mosqueId: string, from: string, to: string): Promise<PrayerDay[]> {
    const rows = await this.prisma.prayerDay.findMany({ where: { mosqueId, date: { gte: from, lte: to } }, orderBy: { date: "asc" } });
    return rows.map((r) => rowToDay(r));
  }

  async day(mosqueId: string, date: string): Promise<PrayerDay | null> {
    const r = await this.prisma.prayerDay.findUnique({ where: { mosqueId_date: { mosqueId, date } } });
    return r ? rowToDay(r) : null;
  }

  /** Correction manuelle d'un jour → source `override`. */
  async override(mosqueId: string, date: string, patch: { times?: Partial<Record<TimeKey, string>>; iqama?: Partial<Record<Prayer, string>> }): Promise<PrayerDay> {
    const ctx = await this.loadContext(mosqueId);
    const current = (await this.day(mosqueId, date)) ?? resolveDay({ date, latitude: ctx.mosque.latitude, longitude: ctx.mosque.longitude, timezone: ctx.mosque.timezone, config: ctx.config, iqamaRules: ctx.iqamaRules });
    const times = { ...current.times, ...(patch.times ?? {}) };
    const iqama = patch.iqama ? { ...current.iqama, ...patch.iqama } : (patch.times ? { ...resolveIqama(times, ctx.iqamaRules), ...pickChangedIqama(current) } : current.iqama);
    const next: PrayerDay = { ...current, times, iqama, source: "override" };
    const row = dayToRow(mosqueId, next);
    const { mosqueId: _m, date: _d, ...data } = row;
    await this.prisma.prayerDay.upsert({ where: { mosqueId_date: { mosqueId, date } }, create: row, update: data });
    return next;

    /** Si l'utilisateur ne touche que les horaires, on recalcule l'iqama à partir des règles ; les iqama existants d'un override précédent restent prioritaires. */
    function pickChangedIqama(c: PrayerDay) { return c.source === "override" ? c.iqama : {}; }
  }

  /** Supprime la correction manuelle et recalcule le jour. */
  async clearOverride(mosqueId: string, date: string): Promise<PrayerDay> {
    const ctx = await this.loadContext(mosqueId);
    const d = resolveDay({ date, latitude: ctx.mosque.latitude, longitude: ctx.mosque.longitude, timezone: ctx.mosque.timezone, config: ctx.config, iqamaRules: ctx.iqamaRules });
    const row = dayToRow(mosqueId, d);
    const { mosqueId: _m, date: _d, ...data } = row;
    await this.prisma.prayerDay.upsert({ where: { mosqueId_date: { mosqueId, date } }, create: row, update: data });
    return d;
  }

  /** Import calendrier : les lignes deviennent des jours `calendar` (sauf si un `override` existe sur la date). */
  async importCalendar(mosqueId: string, rows: Array<{ date: string; times: Record<TimeKey, string> }>): Promise<number> {
    if (!rows.length) return 0;
    const ctx = await this.loadContext(mosqueId);
    const overridden = new Set((await this.prisma.prayerDay.findMany({ where: { mosqueId, source: "override", date: { in: rows.map((r) => r.date) } }, select: { date: true } })).map((r) => r.date));
    const days = rows.filter((r) => !overridden.has(r.date)).map((r) => resolveDay({ date: r.date, latitude: ctx.mosque.latitude, longitude: ctx.mosque.longitude, timezone: ctx.mosque.timezone, config: ctx.config, iqamaRules: ctx.iqamaRules, override: r.times, overrideSource: "calendar" }));
    const dates = days.map((d) => d.date);
    await this.prisma.$transaction([
      this.prisma.prayerDay.deleteMany({ where: { mosqueId, date: { in: dates } } }),
      this.prisma.prayerDay.createMany({ data: days.map((d) => dayToRow(mosqueId, d)) }),
    ]);
    return days.length;
  }

  assertIsoDate(s: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestException("Date attendue au format YYYY-MM-DD");
  }
}

export function isoDateShiftFrom(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta, 12));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}
