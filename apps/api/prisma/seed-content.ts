/**
 * Initialisation de production : charge UNIQUEMENT la bibliothèque de contenus (aucun compte, aucune mosquée de démo).
 * Idempotent.   pnpm --filter @nidaa/api prisma:seed-content
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pgPoolConfig } from "../src/prisma/pg-config";
import { seedContentLibrary } from "./content-library";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant");
const prisma = new PrismaClient({ adapter: new PrismaPg(pgPoolConfig()) });

seedContentLibrary(prisma)
  .then((n) => console.log(`Bibliothèque de contenus : ${n} éléments en place.`))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
