import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrayerDayService } from "./prayer-day.service";
import { PrayerTimesService } from "./prayer-times.service";
import { PrayerTimesController } from "./prayer-times.controller";

@Module({ imports: [AuthModule], controllers: [PrayerTimesController], providers: [PrayerDayService, PrayerTimesService], exports: [PrayerDayService, PrayerTimesService] })
export class PrayerTimesModule {}
