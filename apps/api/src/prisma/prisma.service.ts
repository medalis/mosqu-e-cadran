import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pgPoolConfig } from "./pg-config";

/**
 * Client Prisma avec l'adaptateur `pg` (moteur de requêtes WASM embarqué dans @prisma/client :
 * aucun binaire natif à télécharger, image Docker plus légère). Pool : voir pg-config.ts (pooler Supabase, TLS).
 */
export function createPrismaClient() {
  const adapter = new PrismaPg(pgPoolConfig());
  return new PrismaClient({ adapter, log: process.env.PRISMA_LOG ? ["query", "warn", "error"] : ["warn", "error"] });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PrismaService.name);
  constructor() {
    super({ adapter: new PrismaPg(pgPoolConfig()), log: process.env.PRISMA_LOG ? ["query", "warn", "error"] : ["warn", "error"] });
  }
  async onModuleInit() {
    await this.$connect();
    this.log.log("Connecté à PostgreSQL");
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
