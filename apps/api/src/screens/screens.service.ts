import { BadRequestException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import { type ScreenBundle, type ScreenSettings, ScreenSettingsSchema, type SpecialPrayer, type JumuaSlot, type AnnouncementInput } from "@nidaa/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PrayerDayService, isoDateShift, isoDateShiftFrom } from "../prayer-times/prayer-day.service";
import { AnnouncementsService } from "../announcements/announcements.service";
import { hmac, pairingCode, randomToken, sha256 } from "../common/utils";

const PAIRING_TTL_MS = 10 * 60_000;
export const BUNDLE_DAYS = 30;

@Injectable()
export class ScreensService {
  constructor(private readonly prisma: PrismaService, private readonly days: PrayerDayService, private readonly announcements: AnnouncementsService) {}

  // ----- paramètres -----
  async getSettings(mosqueId: string): Promise<ScreenSettings> {
    const row = await this.prisma.screenSettings.findUnique({ where: { mosqueId } });
    return ScreenSettingsSchema.parse(row?.settings ?? {});
  }
  async putSettings(mosqueId: string, settings: ScreenSettings): Promise<ScreenSettings> {
    await this.prisma.screenSettings.upsert({ where: { mosqueId }, create: { mosqueId, settings }, update: { settings } });
    return settings;
  }

  // ----- appareils (back-office) -----
  listDevices(mosqueId: string) {
    return this.prisma.screenDevice.findMany({ where: { mosqueId }, orderBy: { createdAt: "asc" }, omit: { deviceTokenHash: true } });
  }

  /** Associe un code d'appairage affiché par l'écran à la mosquée. L'écran récupère son jeton au prochain poll. */
  async claim(mosqueId: string, code: string, name?: string) {
    const device = await this.prisma.screenDevice.findUnique({ where: { pairingCode: code.toUpperCase().trim() } });
    if (!device) throw new NotFoundException("Code d'appairage inconnu");
    if (device.mosqueId) throw new BadRequestException("Ce code a déjà été utilisé");
    if (!device.pairingExpiresAt || device.pairingExpiresAt < new Date()) throw new GoneException("Code d'appairage expiré — relancez l'écran");
    return this.prisma.screenDevice.update({ where: { id: device.id }, data: { mosqueId, name: name ?? null, pairedAt: new Date() }, omit: { deviceTokenHash: true } });
  }

  async removeDevice(mosqueId: string, deviceId: string) {
    const d = await this.prisma.screenDevice.findFirst({ where: { id: deviceId, mosqueId } });
    if (!d) throw new NotFoundException("Écran introuvable");
    await this.prisma.screenDevice.delete({ where: { id: deviceId } });
  }

  // ----- appairage (côté écran) -----
  async startPairing(appVersion?: string) {
    await this.prisma.screenDevice.deleteMany({ where: { mosqueId: null, pairingExpiresAt: { lt: new Date() } } });
    let code = pairingCode();
    while (await this.prisma.screenDevice.findUnique({ where: { pairingCode: code }, select: { id: true } })) code = pairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    const device = await this.prisma.screenDevice.create({ data: { pairingCode: code, pairingExpiresAt: expiresAt, appVersion: appVersion ?? null } });
    return { code, expiresAt: expiresAt.toISOString(), pollToken: this.pollTokenFor(device.id, code) };
  }

  /** 202 tant que non réclamé ; 200 + jeton (émis une seule fois) dès que le back-office a réclamé le code. */
  async pollPairing(code: string, pollToken: string | undefined): Promise<{ status: "waiting" } | { deviceToken: string; mosqueId: string }> {
    const device = await this.prisma.screenDevice.findUnique({ where: { pairingCode: code.toUpperCase().trim() } });
    if (!device) throw new NotFoundException("Code d'appairage inconnu ou déjà consommé");
    if (!pollToken || pollToken !== this.pollTokenFor(device.id, device.pairingCode!)) throw new NotFoundException("pollToken invalide");
    if (!device.mosqueId) {
      if (device.pairingExpiresAt && device.pairingExpiresAt < new Date()) { await this.prisma.screenDevice.delete({ where: { id: device.id } }); throw new GoneException("Code expiré"); }
      return { status: "waiting" };
    }
    const deviceToken = `nd_${randomToken(32)}`;
    await this.prisma.screenDevice.update({ where: { id: device.id }, data: { deviceTokenHash: sha256(deviceToken), pairingCode: null, pairingExpiresAt: null, lastSeenAt: new Date() } });
    return { deviceToken, mosqueId: device.mosqueId };
  }

  private pollTokenFor(deviceId: string, code: string) { return hmac(`poll:${deviceId}:${code}`); }

  async heartbeat(deviceId: string, body: { appVersion?: string | null; clockDriftMs?: number | null; bundleVersion?: number | null }) {
    await this.prisma.screenDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date(), appVersion: body.appVersion ?? undefined, clockDriftMs: body.clockDriftMs ?? undefined, bundleVersion: body.bundleVersion ?? undefined } });
  }

  async touch(deviceId: string) {
    await this.prisma.screenDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }

  // ----- bundle -----
  async mosqueVersion(mosqueId: string): Promise<number> {
    const m = await this.prisma.mosque.findUnique({ where: { id: mosqueId }, select: { version: true } });
    if (!m) throw new NotFoundException("Mosquée introuvable");
    return m.version;
  }

  async bundle(mosqueId: string): Promise<ScreenBundle> {
    const m = await this.prisma.mosque.findUnique({
      where: { id: mosqueId },
      include: { prayerConfig: true, iqamaRules: true, jumuaSlots: { orderBy: { position: "asc" } }, specialPrayers: { orderBy: { date: "asc" } }, screenSettings: true, flashMessage: true },
    });
    if (!m) throw new NotFoundException("Mosquée introuvable");
    const now = new Date();
    const from = isoDateShift(m.timezone, -1, now);
    const to = isoDateShiftFrom(from, BUNDLE_DAYS - 1);
    const [days, announcements, contentItems] = await Promise.all([
      this.days.range(mosqueId, from, to),
      this.announcements.activeFor(mosqueId, "screen", now),
      this.prisma.contentItem.findMany({ where: { isActive: true }, orderBy: { kind: "asc" } }),
    ]);
    const flashActive = m.flashMessage && m.flashMessage.isActive && (!m.flashMessage.startsAt || m.flashMessage.startsAt <= now) && (!m.flashMessage.endsAt || m.flashMessage.endsAt >= now);
    return {
      version: m.version,
      generatedAt: now.toISOString(),
      serverTime: now.toISOString(),
      mosque: { id: m.id, slug: m.slug, name: m.name, nameAr: m.nameAr, city: m.city, timezone: m.timezone, latitude: m.latitude, longitude: m.longitude },
      settings: ScreenSettingsSchema.parse(m.screenSettings?.settings ?? {}),
      prayerConfig: this.days.toConfig(m.prayerConfig),
      iqamaRules: m.iqamaRules.map((r) => this.days.toRule(r)),
      jumua: m.jumuaSlots.map((j): JumuaSlot => ({ khutbaTime: j.khutbaTime, prayerTime: j.prayerTime, language: j.language, position: j.position })),
      specialPrayers: m.specialPrayers.map((s): SpecialPrayer => ({ kind: s.kind as SpecialPrayer["kind"], label: s.label, date: s.date, time: s.time, locationNote: s.locationNote })),
      days,
      announcements: announcements.map((a): AnnouncementInput & { id: string } => ({
        id: a.id, type: a.type as AnnouncementInput["type"], title: a.title, body: a.body, mediaUrl: a.mediaUrl,
        startsAt: a.startsAt?.toISOString() ?? null, endsAt: a.endsAt?.toISOString() ?? null, durationSec: a.durationSec, targets: a.targets as AnnouncementInput["targets"], isActive: a.isActive,
      })),
      flashMessage: flashActive ? m.flashMessage!.text : null,
      contentItems: contentItems.map((c) => ({ id: c.id, kind: c.kind as ScreenBundle["contentItems"][number]["kind"], textAr: c.textAr, textFr: c.textFr, textEn: c.textEn, reference: c.reference, context: c.context as ScreenBundle["contentItems"][number]["context"] })),
    };
  }
}
