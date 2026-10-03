import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrayerTimesModule } from "../prayer-times/prayer-times.module";
import { MosquesService } from "./mosques.service";
import { MosquesController } from "./mosques.controller";

@Module({ imports: [AuthModule, PrayerTimesModule], controllers: [MosquesController], providers: [MosquesService], exports: [MosquesService] })
export class MosquesModule {}
