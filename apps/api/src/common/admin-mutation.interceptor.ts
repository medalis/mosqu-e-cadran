import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, from } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { AuditService } from "./audit.service";
import { VersionEventsService } from "../events/version-events.service";

/**
 * Appliqué aux contrôleurs d'administration : pour toute mutation (non GET)
 *  1. journalise l'action (action, entityType, entityId, diff = corps) ;
 *  2. incrémente `mosque.version` et publie l'événement SSE `version`.
 */
@Injectable()
export class AdminMutationInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService, private readonly events: VersionEventsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next.handle();
    if (typeof req.route?.path === "string" && req.route.path.endsWith("/preview")) return next.handle(); // lecture seule
    const params = req.params ?? {};
    const mosqueIdFromParam: string | undefined = params.id;
    return next.handle().pipe(
      mergeMap((result: any) =>
        from(
          (async () => {
            const mosqueId = mosqueIdFromParam ?? (result && typeof result === "object" ? result.id : undefined) ?? null;
            const segments = (req.route?.path as string | undefined)?.split("/").filter((s: string) => s && !s.startsWith(":")) ?? [];
            const entityType = segments.filter((s) => !["v1", "admin", "mosques"].includes(s)).pop() ?? "mosque";
            const entityParamKeys = Object.keys(params).filter((k) => k !== "id");
            const entityId = entityParamKeys.length ? String(params[entityParamKeys[entityParamKeys.length - 1]]) : (result && typeof result === "object" && typeof result.id === "string" ? result.id : mosqueId);
            await this.audit.log({
              mosqueId,
              actorUserId: req.user?.id ?? null,
              action: `${req.method} ${req.route?.path ?? req.path}`,
              entityType,
              entityId,
              diff: req.body && Object.keys(req.body).length ? req.body : undefined,
              ip: req.ip,
            });
            if (mosqueIdFromParam) await this.events.bump(mosqueIdFromParam);
            return result;
          })(),
        ),
      ),
    );
  }
}
