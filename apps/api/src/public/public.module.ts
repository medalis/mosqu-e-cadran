import { Module } from "@nestjs/common";
import { PrayerTimesModule } from "../prayer-times/prayer-times.module";
import { AnnouncementsModule } from "../announcements/announcements.module";
import { PublicService } from "./public.service";
import { PublicController } from "./public.controller";

@Module({ imports: [PrayerTimesModule, AnnouncementsModule], controllers: [PublicController], providers: [PublicService] })
export class PublicModule {}
