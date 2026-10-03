import { Injectable, NotFoundException } from "@nestjs/common";
import { type IqamaRule, type JumuaSlot, type PrayerConfig, type SpecialPrayer } from "@nidaa/shared";
import { parseCalendarCsv } from "@nidaa/prayer-engine";
import { PrismaService } from "../prisma/prisma.service";
import { PrayerDayService } from "./prayer-day.service";

@Injectable()
export class PrayerTimesService {
  constructor(private readonly prisma: PrismaService, private readonly days: PrayerDayService) {}

  async getConfig(mosqueId: string): Promise<PrayerConfig> {
    const row = await this.prisma.prayerConfig.findUnique({ where: { mosqueId } });
    return this.days.toConfig(row);
  }

  async putConfig(mosqueId: string, config: PrayerConfig): Promise<PrayerConfig> {
    await this.prisma.prayerConfig.upsert({ where: { mosqueId }, create: { mosqueId, ...config }, update: config });
    await this.days.rebuild(mosqueId);
    return this.getConfig(mosqueId);
  }

  async getIqamaRules(mosqueId: string): Promise<IqamaRule[]> {
    const rows = await this.prisma.iqamaRule.findMany({ where: { mosqueId } });
    const order = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    return rows.map((r) => this.days.toRule(r)).sort((a, b) => order.indexOf(a.prayer) - order.indexOf(b.prayer));
  }

  async putIqamaRules(mosqueId: string, rules: IqamaRule[]): Promise<IqamaRule[]> {
    await this.prisma.$transaction([
      this.prisma.iqamaRule.deleteMany({ where: { mosqueId } }),
      this.prisma.iqamaRule.createMany({ data: rules.map((r) => ({ mosqueId, prayer: r.prayer, mode: r.mode, delayMin: r.mode === "delay" ? r.delayMin : null, fixedTime: r.mode === "fixed" ? r.fixedTime : null })) }),
    ]);
    await this.days.rebuild(mosqueId);
    return this.getIqamaRules(mosqueId);
  }

  getJumua(mosqueId: string) {
    return this.prisma.jumuaSlot.findMany({ where: { mosqueId }, orderBy: { position: "asc" } });
  }

  async putJumua(mosqueId: string, slots: JumuaSlot[]) {
    await this.prisma.$transaction([
      this.prisma.jumuaSlot.deleteMany({ where: { mosqueId } }),
      this.prisma.jumuaSlot.createMany({ data: slots.map((s, i) => ({ mosqueId, khutbaTime: s.khutbaTime, prayerTime: s.prayerTime, language: s.language, position: s.position ?? i })) }),
    ]);
    return this.getJumua(mosqueId);
  }

  listSpecial(mosqueId: string) {
    return this.prisma.specialPrayer.findMany({ where: { mosqueId }, orderBy: [{ date: "asc" }, { time: "asc" }] });
  }
  createSpecial(mosqueId: string, sp: SpecialPrayer) {
    return this.prisma.specialPrayer.create({ data: { mosqueId, ...sp } });
  }
  async updateSpecial(mosqueId: string, spId: string, patch: Partial<SpecialPrayer>) {
    await this.assertOwned(this.prisma.specialPrayer, mosqueId, spId, "Prière spéciale");
    return this.prisma.specialPrayer.update({ where: { id: spId }, data: patch });
  }
  async deleteSpecial(mosqueId: string, spId: string) {
    await this.assertOwned(this.prisma.specialPrayer, mosqueId, spId, "Prière spéciale");
    await this.prisma.specialPrayer.delete({ where: { id: spId } });
  }

  async importCsv(mosqueId: string, userId: string, csv: string, fileName?: string) {
    const { rows, errors } = parseCalendarCsv(csv);
    const imported = await this.days.importCalendar(mosqueId, rows);
    const years = [...new Set(rows.map((r) => Number(r.date.slice(0, 4))))];
    await this.prisma.calendarImport.create({
      data: { mosqueId, year: years[0] ?? new Date().getFullYear(), fileName: fileName ?? null, rowsCount: imported, status: imported === 0 ? "failed" : errors.length ? "partial" : "ok", errors: errors.length ? (errors as never) : undefined, importedBy: userId },
    });
    if (imported > 0) await this.prisma.prayerConfig.updateMany({ where: { mosqueId }, data: { source: "calendar" } });
    return { imported, errors };
  }

  csvTemplate(mosqueId: string): Promise<string> {
    return this.days.preview(mosqueId, { days: 31 }).then((days) => {
      const header = "date,fajr,shuruq,dhuhr,asr,maghrib,isha";
      const lines = days.map((d) => [d.date, d.times.fajr, d.times.shuruq, d.times.dhuhr, d.times.asr, d.times.maghrib, d.times.isha].join(","));
      return [header, ...lines].join("\n") + "\n";
    });
  }

  private async assertOwned(model: { findFirst: (args: { where: { id: string; mosqueId: string } }) => Promise<unknown> }, mosqueId: string, id: string, label: string) {
    if (!(await model.findFirst({ where: { id, mosqueId } }))) throw new NotFoundException(`${label} introuvable`);
  }
}
