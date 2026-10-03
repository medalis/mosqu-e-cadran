import { Injectable, NotFoundException } from "@nestjs/common";
import type { AnnouncementInput } from "@nidaa/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  list(mosqueId: string) {
    return this.prisma.announcement.findMany({ where: { mosqueId }, orderBy: [{ position: "asc" }, { createdAt: "desc" }] });
  }

  async create(mosqueId: string, input: AnnouncementInput) {
    const count = await this.prisma.announcement.count({ where: { mosqueId } });
    const { startsAt, endsAt, ...rest } = input;
    return this.prisma.announcement.create({ data: { mosqueId, ...rest, startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null, position: count } });
  }

  async update(mosqueId: string, id: string, patch: Partial<AnnouncementInput> & { position?: number }) {
    await this.assertOwned(mosqueId, id);
    const { position, ...rest } = patch;
    return this.prisma.announcement.update({ where: { id }, data: { ...this.toData(rest), ...(position != null ? { position } : {}) } });
  }

  async remove(mosqueId: string, id: string) {
    await this.assertOwned(mosqueId, id);
    await this.prisma.announcement.delete({ where: { id } });
  }

  async getFlash(mosqueId: string) {
    const f = await this.prisma.flashMessage.findUnique({ where: { mosqueId } });
    return f ? { text: f.text, isActive: f.isActive } : { text: "", isActive: false };
  }

  async putFlash(mosqueId: string, body: { text: string; isActive: boolean }) {
    const f = await this.prisma.flashMessage.upsert({ where: { mosqueId }, create: { mosqueId, ...body }, update: body });
    return { text: f.text, isActive: f.isActive };
  }

  /** Annonces actives, dans leur fenêtre de dates, pour une cible donnée. */
  async activeFor(mosqueId: string, target: "screen" | "web" | "app", now = new Date()) {
    const rows = await this.prisma.announcement.findMany({
      where: { mosqueId, isActive: true, targets: { has: target }, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });
    return rows;
  }

  private toData(input: Partial<AnnouncementInput>) {
    const { startsAt, endsAt, ...rest } = input;
    return { ...rest, ...(startsAt !== undefined ? { startsAt: startsAt ? new Date(startsAt) : null } : {}), ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}) };
  }

  private async assertOwned(mosqueId: string, id: string) {
    if (!(await this.prisma.announcement.findFirst({ where: { id, mosqueId }, select: { id: true } }))) throw new NotFoundException("Annonce introuvable");
  }
}
