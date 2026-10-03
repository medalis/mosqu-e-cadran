import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { VersionEventsService } from "../events/version-events.service";
import { AuditService } from "../common/audit.service";

export interface ContentItemInput { kind: "hadith" | "ayah" | "dua" | "dhikr"; textAr: string; textFr?: string | null; textEn?: string | null; reference?: string | null; context: "after_adhan" | "after_prayer" | "rotation"; isActive?: boolean }

@Injectable()
export class SuperService {
  constructor(private readonly prisma: PrismaService, private readonly events: VersionEventsService, private readonly audit: AuditService) {}

  listMosques(status?: string) {
    return this.prisma.mosque.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: { members: { where: { role: "owner" }, include: { user: { select: { email: true, fullName: true } } }, take: 1 }, _count: { select: { screenDevices: true } } },
    });
  }

  async setStatus(id: string, actorId: string, action: "approve" | "reject" | "suspend", reason?: string) {
    const m = await this.prisma.mosque.findUnique({ where: { id } });
    if (!m) throw new NotFoundException("Mosquée introuvable");
    const data =
      action === "approve" ? { status: "published", rejectionReason: null, validatedBy: actorId, validatedAt: new Date() }
      : action === "reject" ? { status: "rejected", rejectionReason: reason ?? "Non précisé" }
      : { status: "suspended" };
    if (action === "approve" && !["pending", "draft", "rejected", "suspended"].includes(m.status)) throw new BadRequestException(`Statut actuel : ${m.status}`);
    const updated = await this.prisma.mosque.update({ where: { id }, data });
    await this.audit.log({ mosqueId: id, actorUserId: actorId, action: `super.${action}`, entityType: "mosque", entityId: id, diff: { from: m.status, to: updated.status, reason } });
    const version = await this.events.bump(id);
    return { ...updated, version };
  }

  listContent() { return this.prisma.contentItem.findMany({ orderBy: [{ kind: "asc" }, { context: "asc" }] }); }
  createContent(input: ContentItemInput) { return this.prisma.contentItem.create({ data: input }); }
  async updateContent(id: string, patch: Partial<ContentItemInput>) {
    if (!(await this.prisma.contentItem.findUnique({ where: { id } }))) throw new NotFoundException("Contenu introuvable");
    return this.prisma.contentItem.update({ where: { id }, data: patch });
  }
  async deleteContent(id: string) {
    if (!(await this.prisma.contentItem.findUnique({ where: { id } }))) throw new NotFoundException("Contenu introuvable");
    await this.prisma.contentItem.delete({ where: { id } });
  }

  async stats() {
    const since = new Date(Date.now() - 2 * 60_000);
    const [mosques, published, screensOnline, users] = await Promise.all([
      this.prisma.mosque.count(),
      this.prisma.mosque.count({ where: { status: "published" } }),
      this.prisma.screenDevice.count({ where: { mosqueId: { not: null }, lastSeenAt: { gte: since } } }),
      this.prisma.user.count(),
    ]);
    return { mosques, published, screensOnline, users };
  }
}
