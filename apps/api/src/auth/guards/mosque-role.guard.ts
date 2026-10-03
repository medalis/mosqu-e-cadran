import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { MemberRole } from "@nidaa/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { ROLES_KEY } from "../../common/decorators";

/** Vérifie que l'utilisateur est membre de la mosquée `:id` avec un rôle autorisé (@Roles). Le super-admin passe. */
@Injectable()
export class MosqueRoleGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    const mosqueId: string | undefined = req.params?.id;
    if (!user || !mosqueId) throw new ForbiddenException();
    const roles = this.reflector.getAllAndOverride<MemberRole[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (user.isSuperAdmin) {
      const exists = await this.prisma.mosque.findUnique({ where: { id: mosqueId }, select: { id: true } });
      if (!exists) throw new NotFoundException("Mosquée introuvable");
      req.membershipRole = "owner";
      return true;
    }
    const member = await this.prisma.mosqueMember.findUnique({ where: { mosqueId_userId: { mosqueId, userId: user.id } } });
    if (!member) throw new ForbiddenException("Vous n'êtes pas membre de cette mosquée");
    if (roles?.length && !roles.includes(member.role as MemberRole)) throw new ForbiddenException(`Rôle requis : ${roles.join(" ou ")}`);
    req.membershipRole = member.role;
    return true;
  }
}
