import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AnnouncementsService } from "./announcements.service";
import { AnnouncementsController } from "./announcements.controller";

@Module({ imports: [AuthModule], controllers: [AnnouncementsController], providers: [AnnouncementsService], exports: [AnnouncementsService] })
export class AnnouncementsModule {}
