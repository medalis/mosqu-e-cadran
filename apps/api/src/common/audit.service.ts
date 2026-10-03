import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry { mosqueId?: string | null; actorUserId?: string | null; action: string; entityType: string; entityId?: string | null; diff?: unknown; ip?: string | null }

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async log(e: AuditEntry) {
    try {
      await this.prisma.auditLog.create({
        data: { mosqueId: e.mosqueId ?? null, actorUserId: e.actorUserId ?? null, action: e.action, entityType: e.entityType, entityId: e.entityId ?? null, diff: (e.diff ?? undefined) as never, ip: e.ip ?? null },
      });
    } catch {
      /* le journal ne doit jamais faire échouer la requête */
    }
  }
}
