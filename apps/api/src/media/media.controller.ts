import { type ArgumentsHost, BadRequestException, Body, Catch, Controller, Delete, type ExceptionFilter, ForbiddenException, Get, HttpCode, Param, Patch, PayloadTooLargeException, Post, Query, Req, UploadedFile, UseFilters, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { MediaService } from "./media.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MosqueRoleGuard } from "../auth/guards/mosque-role.guard";
import { zodBody } from "../common/zod-validation.pipe";
import { Roles } from "../common/decorators";
import { AdminMutationInterceptor } from "../common/admin-mutation.interceptor";
import { MAX_IMAGE_BYTES, MEDIA_KINDS, type MediaKind } from "../storage/image-validation";

const OrderBody = z.object({ ids: z.array(z.string().uuid()).max(100) });
const parseKind = (v: unknown, fallback?: MediaKind): MediaKind | undefined => {
  if (v == null || v === "") return fallback;
  if (typeof v === "string" && (MEDIA_KINDS as readonly string[]).includes(v)) return v as MediaKind;
  throw new BadRequestException(`kind invalide : ${MEDIA_KINDS.join(" | ")}`);
};

/** multer interrompt l'envoi au-delà de la limite avec un message anglais (« File too large ») : on répond en français. */
@Catch(PayloadTooLargeException)
class TooLargeFilter implements ExceptionFilter {
  catch(_e: PayloadTooLargeException, host: ArgumentsHost) {
    host.switchToHttp().getResponse().status(413).json({ statusCode: 413, error: "Payload Too Large", message: `Image trop lourde. La taille maximale est de ${MAX_IMAGE_BYTES / 1024 / 1024} Mo.` });
  }
}

@ApiTags("admin")
@ApiBearerAuth("jwt")
@Controller("admin/mosques/:id/media")
@UseGuards(JwtAuthGuard, MosqueRoleGuard)
@UseInterceptors(AdminMutationInterceptor)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list(@Param("id") id: string, @Query("kind") kind?: string) {
    return this.media.list(id, parseKind(kind));
  }

  /**
   * Envoi multipart (champ `file`, champ facultatif `kind`). Le fichier reste en mémoire (5 Mo au plus) ; multer coupe
   * au-delà de 5 Mo + 1 octet pour ne jamais charger un fichier énorme ; la réponse est alors un 413 en français.
   */
  @Post()
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" }, kind: { type: "string", enum: [...MEDIA_KINDS] } } } })
  @UseFilters(TooLargeFilter)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_IMAGE_BYTES + 1, files: 1, fields: 5 } }))
  upload(@Param("id") id: string, @Req() req: { membershipRole?: string }, @UploadedFile() file: { buffer: Buffer } | undefined, @Body("kind") kind?: string) {
    const k = parseKind(kind, "photo")!;
    // Les photos de la fiche se gèrent comme la fiche (propriétaire ou administrateur) ; une image d'annonce, comme une annonce.
    if (k === "photo" && !["owner", "admin"].includes(req.membershipRole ?? "")) throw new ForbiddenException("Rôle requis : owner ou admin");
    return this.media.upload(id, k, file?.buffer);
  }

  @Patch("order")
  @Roles("owner", "admin")
  reorder(@Param("id") id: string, @Body(zodBody(OrderBody)) body: z.infer<typeof OrderBody>) {
    return this.media.reorder(id, body.ids);
  }

  @Delete(":mediaId")
  @HttpCode(204)
  async remove(@Param("id") id: string, @Param("mediaId") mediaId: string) {
    await this.media.remove(id, mediaId);
  }
}
