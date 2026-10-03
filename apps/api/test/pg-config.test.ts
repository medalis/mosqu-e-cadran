import { describe, expect, it } from "vitest";
import { isLocalDbHost, pgPoolConfig } from "../src/prisma/pg-config";

describe("pgPoolConfig", () => {
  it("local : pas de TLS, 5 connexions par défaut", () => {
    const c = pgPoolConfig({ DATABASE_URL: "postgresql://nidaa:nidaa@localhost:5432/nidaa" });
    expect(c).toMatchObject({ ssl: false, max: 5, connectionString: "postgresql://nidaa:nidaa@localhost:5432/nidaa" });
  });

  it("service Docker sans point (VM unique) : pas de TLS", () => {
    expect(isLocalDbHost("postgres")).toBe(true);
    expect(pgPoolConfig({ DATABASE_URL: "postgresql://nidaa:x@postgres:5432/nidaa" }).ssl).toBe(false);
  });

  it("pooler Supabase : TLS vérifié, paramètres Prisma retirés de l'URL", () => {
    const c = pgPoolConfig({ DATABASE_URL: "postgresql://postgres.ref:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require" });
    expect(c.ssl).toEqual({ rejectUnauthorized: true });
    expect(c.connectionString).toBe("postgresql://postgres.ref:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres");
  });

  it("DB_SSL_CA (avec \\n échappés) ou DB_SSL_CA_FILE fournissent l'autorité", () => {
    const url = "postgresql://u:p@db.exemple.com:5432/postgres";
    expect(pgPoolConfig({ DATABASE_URL: url, DB_SSL_CA: "-----BEGIN CERTIFICATE-----\\nAAA\\n-----END CERTIFICATE-----" }).ssl).toEqual({ rejectUnauthorized: true, ca: "-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----" });
    expect(pgPoolConfig({ DATABASE_URL: url, DB_SSL_CA_FILE: "/etc/secrets/ca.crt" }, (p) => `contenu de ${p}`).ssl).toEqual({ rejectUnauthorized: true, ca: "contenu de /etc/secrets/ca.crt" });
  });

  it("DB_SSL_NO_VERIFY=true chiffre sans vérifier ; sslmode=disable et DB_SSL=false coupent le TLS", () => {
    const url = "postgresql://u:p@db.exemple.com:5432/postgres";
    expect(pgPoolConfig({ DATABASE_URL: url, DB_SSL_NO_VERIFY: "true" }).ssl).toEqual({ rejectUnauthorized: false });
    expect(pgPoolConfig({ DATABASE_URL: `${url}?sslmode=disable` }).ssl).toBe(false);
    expect(pgPoolConfig({ DATABASE_URL: url, DB_SSL: "false" }).ssl).toBe(false);
    expect(pgPoolConfig({ DATABASE_URL: "postgresql://u:p@localhost/db", DB_SSL: "true" }).ssl).toEqual({ rejectUnauthorized: true });
  });

  it("DB_POOL_MAX (et l'ancien DATABASE_POOL_MAX) règlent la taille du pool", () => {
    const url = "postgresql://u:p@localhost/db";
    expect(pgPoolConfig({ DATABASE_URL: url, DB_POOL_MAX: "12" }).max).toBe(12);
    expect(pgPoolConfig({ DATABASE_URL: url, DATABASE_POOL_MAX: "8" }).max).toBe(8);
    expect(pgPoolConfig({ DATABASE_URL: url, DB_POOL_MAX: "abc" }).max).toBe(5);
    expect(() => pgPoolConfig({})).toThrow(/DATABASE_URL/);
  });
});
