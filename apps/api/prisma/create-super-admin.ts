/**
 * Crée (ou promeut) le premier super-administrateur de la plateforme. Ne crée aucune mosquée.
 *
 *   pnpm --filter @nidaa/api prisma:create-admin -- --email admin@exemple.dj --name "Prénom Nom"
 *   SUPER_ADMIN_EMAIL=… SUPER_ADMIN_PASSWORD=… pnpm --filter @nidaa/api prisma:create-admin
 *
 * Le mot de passe vient de SUPER_ADMIN_PASSWORD (recommandé : n'apparaît pas dans l'historique du shell) ou de --password.
 * Si le compte existe déjà, il est promu super-admin ; son mot de passe n'est remplacé qu'avec --reset-password.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pgPoolConfig } from "../src/prisma/pg-config";
import * as argon2 from "argon2";

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("--")) return argv[i + 1];
  return argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");
  const email = (arg("email") ?? process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = arg("password") ?? process.env.SUPER_ADMIN_PASSWORD ?? "";
  const fullName = (arg("name") ?? process.env.SUPER_ADMIN_NAME ?? "Administrateur Nidaa").trim();
  const reset = process.argv.includes("--reset-password");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail manquant ou invalide (--email ou SUPER_ADMIN_EMAIL).");

  const prisma = new PrismaClient({ adapter: new PrismaPg(pgPoolConfig()) });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && !reset) {
      await prisma.user.update({ where: { id: existing.id }, data: { isSuperAdmin: true } });
      console.log(`Compte existant ${email} promu super-admin (mot de passe inchangé ; --reset-password pour le remplacer).`);
      return;
    }
    if (password.length < 12) throw new Error("Mot de passe manquant ou trop court : 12 caractères minimum (SUPER_ADMIN_PASSWORD ou --password).");
    const passwordHash = await argon2.hash(password);
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { isSuperAdmin: true, passwordHash } });
      console.log(`Super-admin ${email} : mot de passe remplacé.`);
    } else {
      await prisma.user.create({ data: { email, passwordHash, fullName, locale: "fr", isSuperAdmin: true, emailVerifiedAt: new Date() } });
      console.log(`Super-admin créé : ${email}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
