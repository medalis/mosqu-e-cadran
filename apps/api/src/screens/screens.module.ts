import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrayerTimesModule } from "../prayer-times/prayer-times.module";
import { AnnouncementsModule } from "../announcements/announcements.module";
import { ScreensService } from "./screens.service";
import { ScreensAdminController } from "./screens-admin.controller";
import { ScreenController } from "./screen.controller";

@Module({ imports: [AuthModule, PrayerTimesModule, AnnouncementsModule], controllers: [ScreensAdminController, ScreenController], providers: [ScreensService], exports: [ScreensService] })
export class ScreensModule {}
