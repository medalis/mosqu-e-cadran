import { Body, Controller, Get, Headers, HttpCode, type MessageEvent, Param, Post, Query, Req, Res, Sse, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { defer, type Observable } from "rxjs";
import { switchMap } from "rxjs/operators";
import { z } from "zod";
import { ScreensService } from "./screens.service";
import { DeviceAuthGuard } from "../auth/guards/device-auth.guard";
import { zodBody } from "../common/zod-validation.pipe";
import { CurrentDevice, type AuthDevice } from "../common/decorators";
import { VersionEventsService } from "../events/version-events.service";

const PairingBody = z.object({ appVersion: z.string().max(40).optional() }).default({});
const HeartbeatBody = z.object({ appVersion: z.string().max(40).nullable().optional(), clockDriftMs: z.number().int().nullable().optional(), bundleVersion: z.number().int().nullable().optional() });

@ApiTags("screen")
@Controller("screen")
export class ScreenController {
  constructor(private readonly svc: ScreensService, private readonly versionEvents: VersionEventsService) {}

  @Post("pairing")
  @HttpCode(201)
  pairing(@Body(zodBody(PairingBody)) body: z.infer<typeof PairingBody>) {
    return this.svc.startPairing(body?.appVersion);
  }

  @Get("pairing/:code")
  async poll(@Param("code") code: string, @Query("pollToken") pollToken: string | undefined, @Res() res: Response) {
    const r = await this.svc.pollPairing(code, pollToken);
    res.status("status" in r ? 202 : 200).json(r);
  }

  @Get("bundle")
  @ApiBearerAuth("device")
  @UseGuards(DeviceAuthGuard)
  async bundle(@CurrentDevice() device: AuthDevice, @Headers("if-none-match") inm: string | undefined, @Res() res: Response) {
    const version = await this.svc.mosqueVersion(device.mosqueId!);
    const etag = `"${version}"`;
    res.setHeader("Cache-Control", "no-cache");
    void this.svc.touch(device.id);
    if (inm && inm.split(",").map((s) => s.trim()).some((t) => t === etag || t === `W/${etag}`)) { res.status(304).setHeader("ETag", etag).end(); return; }
    const bundle = await this.svc.bundle(device.mosqueId!);
    res.setHeader("ETag", `"${bundle.version}"`);
    res.status(200).json(bundle);
  }

  @Sse("events")
  @ApiBearerAuth("device")
  @UseGuards(DeviceAuthGuard)
  events(@CurrentDevice() device: AuthDevice, @Req() req: Request): Observable<MessageEvent> {
    req.socket.setKeepAlive(true);
    req.socket.setTimeout(0);
    return defer(() => this.svc.mosqueVersion(device.mosqueId!)).pipe(switchMap((v) => this.versionEvents.subscribe(device.mosqueId!, v)));
  }

  @Post("heartbeat")
  @HttpCode(204)
  @ApiBearerAuth("device")
  @UseGuards(DeviceAuthGuard)
  async heartbeat(@CurrentDevice() device: AuthDevice, @Body(zodBody(HeartbeatBody)) body: z.infer<typeof HeartbeatBody>) {
    await this.svc.heartbeat(device.id, body);
  }
}
