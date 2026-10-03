import { Controller, Get, type MessageEvent, Param, Query, Req, Sse, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PublicThrottlerGuard } from "./public-throttler.guard";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { defer, type Observable } from "rxjs";
import { switchMap } from "rxjs/operators";
import { PublicService } from "./public.service";
import { VersionEventsService } from "../events/version-events.service";

@ApiTags("public")
@UseGuards(PublicThrottlerGuard) // 120 req/min par IP
@Controller()
export class PublicController {
  constructor(private readonly svc: PublicService, private readonly events: VersionEventsService) {}

  @Get("time")
  time() { return { now: new Date().toISOString() }; }

  @Get("mosques")
  search(@Query("q") q?: string, @Query("city") city?: string, @Query("lat") lat?: string, @Query("lng") lng?: string, @Query("radiusKm") radiusKm?: string) {
    const num = (v?: string) => (v != null && v !== "" ? Number(v) : undefined);
    return this.svc.search({ q: q?.trim() || undefined, city: city?.trim() || undefined, lat: num(lat), lng: num(lng), radiusKm: num(radiusKm) });
  }

  @Get("mosques/:slug") bySlug(@Param("slug") slug: string) { return this.svc.bySlug(slug); }

  @Get("mosques/:slug/times")
  times(@Param("slug") slug: string, @Query("date") date?: string) {
    return this.svc.times(slug, date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined);
  }

  @Get("mosques/:slug/calendar") calendar(@Param("slug") slug: string, @Query("month") month?: string) { return this.svc.calendar(slug, month); }

  @Get("mosques/:slug/announcements") announcements(@Param("slug") slug: string) { return this.svc.publicAnnouncements(slug); }

  @SkipThrottle() // connexion longue : hors limite de débit
  @Sse("mosques/:slug/events")
  sse(@Param("slug") slug: string, @Req() req: Request): Observable<MessageEvent> {
    req.socket.setKeepAlive(true);
    req.socket.setTimeout(0);
    return defer(() => this.svc.publishedForEvents(slug)).pipe(switchMap((m) => this.events.subscribe(m.id, m.version)));
  }
}
