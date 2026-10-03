import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { EventsModule } from "./events/events.module";
import { AuthModule } from "./auth/auth.module";
import { MosquesModule } from "./mosques/mosques.module";
import { PrayerTimesModule } from "./prayer-times/prayer-times.module";
import { AnnouncementsModule } from "./announcements/announcements.module";
import { ScreensModule } from "./screens/screens.module";
import { SuperModule } from "./super/super.module";
import { PublicModule } from "./public/public.module";
import { CommonModule } from "./common/common.module";
import { StorageModule } from "./storage/storage.module";
import { MediaModule } from "./media/media.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env", "../../.env"] }),
    // Limite de débit des routes publiques (appliquée par ThrottlerGuard sur PublicController) : 120 req/min par IP.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: Number(process.env.PUBLIC_RATE_LIMIT ?? 120) }]),
    PrismaModule,
    EventsModule,
    CommonModule,
    AuthModule,
    StorageModule,
    MosquesModule,
    MediaModule,
    PrayerTimesModule,
    AnnouncementsModule,
    ScreensModule,
    SuperModule,
    PublicModule,
  ],
})
export class AppModule {}
