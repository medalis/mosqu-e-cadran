import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PRAYERS, type Prayer, type PrayerDay } from "@nidaa/shared";
import { localToInstant, toIsoDate } from "@nidaa/prayer-engine";
import { PrismaService } from "../prisma/prisma.service";
import { PrayerDayService, isoDateShift, isoDateShiftFrom } from "../prayer-times/prayer-day.service";
import { AnnouncementsService } from "../announcements/announcements.service";
import { haversineKm } from "../common/utils";

const summarySelect = { id: true, slug: true, name: true, nameAr: true, address: true, city: true, countryCode: true, latitude: true, longitude: true, timezone: true, services: true, version: true } satisfies Prisma.MosqueSelect;

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService, private readonly days: PrayerDayService, private readonly announcements: AnnouncementsService) {}

  async search(q: { q?: string; city?: string; lat?: number; lng?: number; radiusKm?: number }) {
    const where: Prisma.MosqueWhereInput = { status: "published" };
    if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { nameAr: { contains: q.q } }, { city: { contains: q.q, mode: "insensitive" } }, { address: { contains: q.q, mode: "insensitive" } }];
    if (q.city) where.city = { equals: q.city, mode: "insensitive" };
    const geo = q.lat != null && q.lng != null && Number.isFinite(q.lat) && Number.isFinite(q.lng);
    const radius = q.radiusKm && q.radiusKm > 0 ? Math.min(q.radiusKm, 500) : 25;
    if (geo) {
      // Pré-filtre par boîte englobante en SQL, puis distance exacte (haversine) en JS — PostGIS indisponible.
      const dLat = radius / 111;
      const dLng = radius / (111 * Math.max(Math.cos((q.lat! * Math.PI) / 180), 0.05));
      where.latitude = { gte: q.lat! - dLat, lte: q.lat! + dLat };
      where.longitude = { gte: q.lng! - dLng, lte: q.lng! + dLng };
    }
    const rows = await this.prisma.mosque.findMany({ where, select: summarySelect, take: geo ? 500 : 100, orderBy: { name: "asc" } });
    if (!geo) return rows;
    return rows
      .map((m) => ({ ...m, distanceKm: Math.round(haversineKm(q.lat!, q.lng!, m.latitude, m.longitude) * 100) / 100 }))
      .filter((m) => m.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 50);
  }

  async bySlug(slug: string) {
    const m = await this.prisma.mosque.findUnique({
      where: { slug },
      include: { jumuaSlots: { orderBy: { position: "asc" } }, specialPrayers: { orderBy: { date: "asc" } }, media: { where: { kind: "photo" }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] } },
    });
    if (!m || m.status !== "published") throw new NotFoundException("Mosquée introuvable");
    const { jumuaSlots, specialPrayers, media, rejectionReason: _r, validatedBy: _v, ...rest } = m;
    return {
      ...rest,
      jumua: jumuaSlots.map((j) => ({ khutbaTime: j.khutbaTime, prayerTime: j.prayerTime, language: j.language, position: j.position })),
      specialPrayers: specialPrayers.map((s) => ({ kind: s.kind, label: s.label, date: s.date, time: s.time, locationNote: s.locationNote })),
      photos: media.map((p) => ({ id: p.id, url: p.url, width: p.width, height: p.height })),
    };
  }

  private async publishedId(slug: string) {
    const m = await this.prisma.mosque.findUnique({ where: { slug }, select: { id: true, status: true, timezone: true, version: true } });
    if (!m || m.status !== "published") throw new NotFoundException("Mosquée introuvable");
    return m;
  }

  async times(slug: string, date?: string) {
    const m = await this.publishedId(slug);
    const now = new Date();
    const day = date ?? toIsoDate(now, m.timezone);
    const [d, tomorrow] = await Promise.all([this.days.day(m.id, day), this.days.day(m.id, isoDateShiftFrom(day, 1))]);
    if (!d) throw new NotFoundException("Aucun horaire pour cette date");
    return { ...d, next: this.nextPrayer(now, m.timezone, d, tomorrow) };
  }

  /** Prochaine prière (adhan) après `now` — aujourd'hui, sinon fajr de demain. */
  nextPrayer(now: Date, timezone: string, today: PrayerDay, tomorrow: PrayerDay | null): { prayer: Prayer; at: string } {
    for (const p of PRAYERS) {
      const at = localToInstant(today.date, today.times[p], timezone);
      if (at > now) return { prayer: p, at: at.toISOString() };
    }
    const t = tomorrow ? localToInstant(tomorrow.date, tomorrow.times.fajr, timezone) : new Date(localToInstant(today.date, today.times.fajr, timezone).getTime() + 864e5);
    return { prayer: "fajr", at: t.toISOString() };
  }

  async calendar(slug: string, month?: string) {
    const m = await this.publishedId(slug);
    const ym = month ?? isoDateShift(m.timezone, 0).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) throw new NotFoundException("month attendu au format YYYY-MM");
    const [y, mo] = ym.split("-").map(Number);
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return this.days.range(m.id, `${ym}-01`, `${ym}-${String(last).padStart(2, "0")}`);
  }

  async publicAnnouncements(slug: string) {
    const m = await this.publishedId(slug);
    const rows = await this.announcements.activeFor(m.id, "web");
    return rows.map((a) => ({ id: a.id, type: a.type, title: a.title, body: a.body, mediaUrl: a.mediaUrl, startsAt: a.startsAt, endsAt: a.endsAt, durationSec: a.durationSec, targets: a.targets, isActive: a.isActive }));
  }

  publishedForEvents(slug: string) { return this.publishedId(slug); }
}
