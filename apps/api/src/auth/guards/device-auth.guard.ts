import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { sha256 } from "../../common/utils";

/** Jeton appareil opaque (Authorization: Bearer ou ?token=) → req.device. */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    let token: string | undefined = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    if (!token && typeof req.query?.token === "string") token = req.query.token;
    if (!token) throw new UnauthorizedException("Jeton appareil manquant");
    const device = await this.prisma.screenDevice.findUnique({ where: { deviceTokenHash: sha256(token) }, select: { id: true, mosqueId: true } });
    if (!device || !device.mosqueId) throw new UnauthorizedException("Jeton appareil invalide");
    req.device = device;
    return true;
  }
}
