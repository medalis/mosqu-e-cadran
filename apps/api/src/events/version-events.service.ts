import { Injectable, Logger, OnModuleDestroy, OnModuleInit, type MessageEvent } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { Observable, interval, merge } from "rxjs";
import { map } from "rxjs/operators";
import Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";

export interface VersionEvent { mosqueId: string; version: number }
const CHANNEL = "nidaa:version";
const PING_MS = 25_000;

/**
 * Fan-out des changements de version. Avec REDIS_URL : pub/sub Redis (plusieurs instances API).
 * Sans : EventEmitter en mémoire (une seule instance) — fonctionne sans Redis.
 */
@Injectable()
export class VersionEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(VersionEventsService.name);
  private readonly local = new EventEmitter();
  private pub?: Redis;
  private sub?: Redis;

  constructor(private readonly prisma: PrismaService) {
    this.local.setMaxListeners(0);
  }

  async onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) { this.log.log("REDIS_URL absent — fan-out SSE en mémoire"); return; }
    try {
      this.pub = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
      this.sub = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
      await this.pub.connect();
      await this.sub.connect();
      await this.sub.subscribe(CHANNEL);
      this.sub.on("message", (_ch, msg) => {
        try { const ev = JSON.parse(msg) as VersionEvent; this.local.emit(ev.mosqueId, ev); } catch { /* ignore */ }
      });
      this.log.log("Fan-out SSE via Redis");
    } catch (e) {
      this.log.warn(`Redis indisponible (${(e as Error).message}) — repli en mémoire`);
      this.pub?.disconnect(); this.sub?.disconnect(); this.pub = this.sub = undefined;
    }
  }

  async onModuleDestroy() { this.pub?.disconnect(); this.sub?.disconnect(); }

  /** Incrémente mosque.version en base et publie l'événement. Retourne la nouvelle version. */
  async bump(mosqueId: string): Promise<number> {
    const m = await this.prisma.mosque.update({ where: { id: mosqueId }, data: { version: { increment: 1 } }, select: { version: true } });
    await this.publish({ mosqueId, version: m.version });
    return m.version;
  }

  async publish(ev: VersionEvent) {
    if (this.pub) { try { await this.pub.publish(CHANNEL, JSON.stringify(ev)); return; } catch (e) { this.log.warn(`publish Redis: ${(e as Error).message}`); } }
    this.local.emit(ev.mosqueId, ev);
  }

  /** Flux SSE : `version` à chaque changement, `ping` toutes les 25 s. Un premier `version` est envoyé à la connexion. */
  subscribe(mosqueId: string, initialVersion?: number): Observable<MessageEvent> {
    const versions = new Observable<MessageEvent>((subscriber) => {
      if (initialVersion != null) subscriber.next({ type: "version", data: { type: "version", version: initialVersion } } as MessageEvent);
      const handler = (ev: VersionEvent) => subscriber.next({ type: "version", data: { type: "version", version: ev.version } } as MessageEvent);
      this.local.on(mosqueId, handler);
      return () => this.local.off(mosqueId, handler);
    });
    const pings = interval(PING_MS).pipe(map(() => ({ type: "ping", data: { type: "ping", at: new Date().toISOString() } }) as MessageEvent));
    return merge(versions, pings);
  }
}
