import { Global, Module } from "@nestjs/common";
import { VersionEventsService } from "./version-events.service";

@Global()
@Module({ providers: [VersionEventsService], exports: [VersionEventsService] })
export class EventsModule {}
