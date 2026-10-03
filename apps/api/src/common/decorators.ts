import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { MemberRole } from "@nidaa/shared";

export interface AuthUser { id: string; email: string; isSuperAdmin: boolean }
export interface AuthDevice { id: string; mosqueId: string | null }

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
export const CurrentDevice = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthDevice => ctx.switchToHttp().getRequest().device);

export const ROLES_KEY = "nidaa:roles";
/** Rôles autorisés sur la mosquée `:id`. Sans décorateur : tout membre. Le super-admin passe toujours. */
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);
