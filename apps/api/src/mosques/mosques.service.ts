import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { type MemberRole, type MosqueInput, PrayerConfigSchema, ScreenSettingsSchema } from "@nidaa/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PrayerDayService } from "../prayer-times/prayer-day.service";
import { slugify } from "../common/utils";

@Injectable()
export class MosquesService {
  constructor(private readonly prisma: PrismaService, private readonly prayerDays: PrayerDayService) {}

  listMine(userId: string, isSuperAdmin: boolean) {
    return this.prisma.mosque.findMany({
      where: isSuperAdmin ? {} : { members: { some: { userId } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(userId: string, input: MosqueInput) {
    const slug = await this.uniqueSlug(input.name);
    const mosque = await this.prisma.mosque.create({
      data: {
        ...input, slug, status: "draft",
        members: { create: { userId, role: "owner", acceptedAt: new Date() } },
        prayerConfig: { create: { ...PrayerConfigSchema.parse({}), adjustments: {} } },
        screenSettings: { create: { settings: ScreenSettingsSchema.parse({}) } },
      },
    });
    await this.prayerDays.rebuild(mosque.id);
    return mosque;
  }

  async getFull(id: string) {
    const m = await this.prisma.mosque.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, email: true, fullName: true } } }, orderBy: { createdAt: "asc" } },
        prayerConfig: true,
        iqamaRules: { orderBy: { prayer: "asc" } },
        jumuaSlots: { orderBy: { position: "asc" } },
        specialPrayers: { orderBy: { date: "asc" } },
        screenSettings: true,
        flashMessage: true,
        media: { orderBy: { position: "asc" } },
      },
    });
    if (!m) throw new NotFoundException("Mosquée introuvable");
    return {
      ...m,
      members: m.members.map((x) => ({ id: x.id, userId: x.userId, role: x.role, email: x.user.email, fullName: x.user.fullName, createdAt: x.createdAt })),
      screenSettings: m.screenSettings ? ScreenSettingsSchema.parse(m.screenSettings.settings) : ScreenSettingsSchema.parse({}),
      flashMessage: m.flashMessage ? { text: m.flashMessage.text, isActive: m.flashMessage.isActive } : null,
    };
  }

  async update(id: string, patch: Partial<MosqueInput>) {
    const before = await this.prisma.mosque.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Mosquée introuvable");
    const m = await this.prisma.mosque.update({ where: { id }, data: patch });
    const geoChanged = (patch.latitude != null && patch.latitude !== before.latitude) || (patch.longitude != null && patch.longitude !== before.longitude) || (patch.timezone && patch.timezone !== before.timezone);
    if (geoChanged) await this.prayerDays.rebuild(id);
    return m;
  }

  async submit(id: string) {
    const m = await this.prisma.mosque.findUnique({ where: { id } });
    if (!m) throw new NotFoundException("Mosquée introuvable");
    if (!["draft", "rejected"].includes(m.status)) throw new BadRequestException(`Impossible de soumettre une mosquée au statut « ${m.status} »`);
    return this.prisma.mosque.update({ where: { id }, data: { status: "pending", rejectionReason: null } });
  }

  // ----- membres -----
  async listMembers(mosqueId: string) {
    const rows = await this.prisma.mosqueMember.findMany({ where: { mosqueId }, include: { user: { select: { email: true, fullName: true } } }, orderBy: { createdAt: "asc" } });
    return rows.map((x) => ({ id: x.id, userId: x.userId, role: x.role, email: x.user.email, fullName: x.user.fullName, createdAt: x.createdAt }));
  }

  async addMember(mosqueId: string, actorId: string, email: string, role: MemberRole) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new NotFoundException("Aucun utilisateur avec cet e-mail — il doit d'abord créer un compte");
    const exists = await this.prisma.mosqueMember.findUnique({ where: { mosqueId_userId: { mosqueId, userId: user.id } } });
    if (exists) throw new ConflictException("Déjà membre de cette mosquée");
    const m = await this.prisma.mosqueMember.create({ data: { mosqueId, userId: user.id, role, invitedBy: actorId, acceptedAt: new Date() } });
    return { id: m.id, userId: m.userId, role: m.role, email: user.email, fullName: user.fullName, createdAt: m.createdAt };
  }

  async updateMember(mosqueId: string, memberId: string, role: MemberRole) {
    const m = await this.prisma.mosqueMember.findFirst({ where: { id: memberId, mosqueId }, include: { user: { select: { email: true, fullName: true } } } });
    if (!m) throw new NotFoundException("Membre introuvable");
    if (m.role === "owner" && role !== "owner") await this.assertNotLastOwner(mosqueId);
    const u = await this.prisma.mosqueMember.update({ where: { id: memberId }, data: { role } });
    return { id: u.id, userId: u.userId, role: u.role, email: m.user.email, fullName: m.user.fullName, createdAt: u.createdAt };
  }

  async removeMember(mosqueId: string, memberId: string) {
    const m = await this.prisma.mosqueMember.findFirst({ where: { id: memberId, mosqueId } });
    if (!m) throw new NotFoundException("Membre introuvable");
    if (m.role === "owner") await this.assertNotLastOwner(mosqueId);
    await this.prisma.mosqueMember.delete({ where: { id: memberId } });
  }

  private async assertNotLastOwner(mosqueId: string) {
    const owners = await this.prisma.mosqueMember.count({ where: { mosqueId, role: "owner" } });
    if (owners <= 1) throw new BadRequestException("La mosquée doit conserver au moins un propriétaire");
  }

  auditLog(mosqueId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { mosqueId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 500),
      include: { actor: { select: { email: true, fullName: true } } },
    });
  }

  private async uniqueSlug(name: string) {
    const base = slugify(name);
    let slug = base;
    for (let i = 2; await this.prisma.mosque.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
    return slug;
  }
}
