import { BadRequestException, Injectable, Logger, NotFoundException, PayloadTooLargeException, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { keyFromUrl } from "../storage/storage.types";
import { ImageValidationError, type MediaKind, assertUnderLimit, mediaKey, validateImage } from "../storage/image-validation";

@Injectable()
export class MediaService {
  private readonly log = new Logger(MediaService.name);
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  list(mosqueId: string, kind?: MediaKind) {
    return this.prisma.media.findMany({ where: { mosqueId, ...(kind ? { kind } : {}) }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  }

  async upload(mosqueId: string, kind: MediaKind, buffer: Buffer | undefined) {
    let info;
    try {
      info = validateImage(buffer);
      assertUnderLimit(await this.prisma.media.count({ where: { mosqueId, kind } }), kind);
    } catch (e) {
      if (e instanceof ImageValidationError) throw e.code === "too_large" ? new PayloadTooLargeException(e.message) : new BadRequestException(e.message);
      throw e;
    }
    const key = mediaKey(mosqueId, randomUUID(), info.ext);
    let url: string;
    try {
      url = await this.storage.put(key, buffer!, info.mime);
    } catch (e) {
      this.log.error(`Envoi vers le stockage impossible (${key}) : ${(e as Error).message}`);
      throw new ServiceUnavailableException("Le stockage des photos est momentanément indisponible. Réessayez dans un instant.");
    }
    try {
      const last = await this.prisma.media.findFirst({ where: { mosqueId, kind }, orderBy: { position: "desc" }, select: { position: true } });
      return await this.prisma.media.create({ data: { mosqueId, kind, url, mime: info.mime, size: info.size, width: info.width, height: info.height, position: (last?.position ?? -1) + 1 } });
    } catch (e) {
      await this.storage.remove(key).catch(() => undefined); // pas d'objet orphelin si la base refuse
      throw e;
    }
  }

  /** Réordonne les photos : `ids` doit contenir exactement les photos de la mosquée, dans le nouvel ordre. */
  async reorder(mosqueId: string, ids: string[]) {
    const photos = await this.prisma.media.findMany({ where: { mosqueId, kind: "photo" }, select: { id: true } });
    const known = new Set(photos.map((p) => p.id));
    if (new Set(ids).size !== ids.length || ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new BadRequestException("La liste doit contenir exactement les photos de la mosquée, chacune une seule fois.");
    }
    await this.prisma.$transaction(ids.map((id, position) => this.prisma.media.update({ where: { id }, data: { position } })));
    return this.list(mosqueId, "photo");
  }

  async remove(mosqueId: string, mediaId: string) {
    const m = await this.prisma.media.findFirst({ where: { id: mediaId, mosqueId } });
    if (!m) throw new NotFoundException("Fichier introuvable");
    await this.prisma.media.delete({ where: { id: m.id } });
    const key = keyFromUrl(m.url);
    // La ligne est supprimée d'abord : un échec du stockage laisse au pire un objet orphelin, jamais une photo cassée.
    if (key) await this.storage.remove(key).catch((e) => this.log.warn(`Objet non supprimé (${key}) : ${(e as Error).message}`));
    if (m.kind === "photo") {
      const rest = await this.prisma.media.findMany({ where: { mosqueId, kind: "photo" }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } });
      await this.prisma.$transaction(rest.map((p, position) => this.prisma.media.update({ where: { id: p.id }, data: { position } })));
    }
  }
}
