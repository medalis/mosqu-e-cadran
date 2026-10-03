import { Controller, Get, NotFoundException, Req, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { StorageService } from "./storage.service";

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** Sert les fichiers du pilote « local » : GET /v1/files/<clé>. Répond 404 avec tout autre pilote. */
@ApiExcludeController()
@Controller("files")
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get("*key")
  async file(@Req() req: Request, @Res() res: Response) {
    const local = this.storage.localDriver;
    const key = decodeURIComponent(req.path.replace(/^\/v1\/files\//, ""));
    const mime = MIME[extname(key).toLowerCase()];
    if (!local || !mime) throw new NotFoundException();
    let path: string;
    try { path = local.pathFor(key); } catch { throw new NotFoundException(); }
    const st = await stat(path).catch(() => null);
    if (!st?.isFile()) throw new NotFoundException();
    // Les clés contiennent un UUID : le contenu d'une URL ne change jamais.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Type", mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(path);
  }
}
