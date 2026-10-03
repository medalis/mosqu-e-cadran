import "./env";
import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { corsOptionsFor, parseOrigins } from "./cors";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  app.setGlobalPrefix("v1");
  app.set("etag", false); // on gère l'ETag nous-mêmes (bundle écran)
  // Derrière le reverse proxy (Caddy) : ne faire confiance qu'au nombre de sauts indiqué, pour que req.ip soit la vraie
  // IP du client (limiteur de débit) sans qu'un X-Forwarded-For forgé soit pris pour argent comptant.
  const trustProxy = process.env.TRUST_PROXY ?? "1";
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === "true" ? true : trustProxy === "false" ? false : trustProxy);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));

  // CORS par requête : lecture publique ouverte à toute origine, le reste limité à CORS_ORIGINS (voir cors.ts).
  const production = process.env.NODE_ENV === "production";
  const origins = parseOrigins(process.env.CORS_ORIGINS);
  if (production && !origins.length) new Logger("Bootstrap").warn("CORS_ORIGINS est vide : le back-office et l'écran seront refusés par le navigateur.");
  app.enableCors((req: { url?: string; originalUrl?: string }, cb: (err: Error | null, options: ReturnType<typeof corsOptionsFor>) => void) =>
    cb(null, corsOptionsFor(req.originalUrl ?? req.url ?? "", origins, production)),
  );

  // Swagger : activé par défaut en développement, désactivé en production sauf SWAGGER_ENABLED=true.
  const swaggerEnv = process.env.SWAGGER_ENABLED?.trim().toLowerCase();
  const swaggerEnabled = swaggerEnv ? swaggerEnv === "true" || swaggerEnv === "1" : !production;
  if (swaggerEnabled) {
    const doc = new DocumentBuilder()
      .setTitle("Nidaa API")
      .setDescription("API de la plateforme de mosquée connectée Nidaa — voir CONTRACT.md")
      .setVersion("0.1.0")
      .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "jwt")
      .addBearerAuth({ type: "http", scheme: "bearer" }, "device")
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, doc));
  }

  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  new Logger("Bootstrap").log(`Nidaa API prête sur http://localhost:${port}/v1 — Swagger ${swaggerEnabled ? "sur /docs" : "désactivé"}`);
}
bootstrap();
