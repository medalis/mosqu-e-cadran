#!/usr/bin/env node
// Lance une commande (CLI Prisma…) en garantissant que DIRECT_URL existe : le schéma déclare
// directUrl = env("DIRECT_URL") et Prisma échoue si la variable est absente. Sans DIRECT_URL (développement
// local, VM unique), on reprend DATABASE_URL. Charge apps/api/.env puis ../../.env sans écraser l'environnement.
//   node scripts/with-direct-url.mjs prisma migrate deploy
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const p of [resolve(root, ".env"), resolve(root, "../../.env")]) {
  if (existsSync(p)) { try { process.loadEnvFile(p); } catch { /* fichier illisible : ignoré */ } }
}
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) process.env.DIRECT_URL = process.env.DATABASE_URL;

// Hors « pnpm run », les binaires locaux (prisma, tsx) ne sont pas dans le PATH.
process.env.PATH = `${resolve(root, "node_modules/.bin")}${delimiter}${process.env.PATH ?? ""}`;

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) { console.error("usage : with-direct-url.mjs <commande> [arguments…]"); process.exit(64); }
const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, env: process.env, shell: process.platform === "win32" });
if (r.error) { console.error(r.error.message); process.exit(127); }
process.exit(r.status ?? 1);
