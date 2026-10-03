import { type ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { timingSafeEqual } from "node:crypto";

/**
 * Limite de débit des routes publiques : 120 req/min par IP (req.ip, voir « trust proxy » dans main.ts).
 * Le site public (apps/web) appelle l'API côté serveur depuis une seule adresse pour tous ses visiteurs :
 * il s'identifie par l'en-tête `X-Internal-Token` (= INTERNAL_API_TOKEN) et n'est alors pas limité.
 */
@Injectable()
export class PublicThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const expected = process.env.INTERNAL_API_TOKEN;
    if (!expected) return false;
    const got = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>().headers["x-internal-token"];
    if (typeof got !== "string" || got.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  }
}
