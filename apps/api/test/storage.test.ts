import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ImageValidationError, MAX_IMAGE_BYTES, MAX_PHOTOS_PER_MOSQUE, assertUnderLimit, imageDimensions, mediaKey, sniffImage, validateImage,
} from "../src/storage/image-validation";
import { LocalStorageDriver } from "../src/storage/local.driver";
import { SupabaseStorageDriver, type FetchLike } from "../src/storage/supabase.driver";
import { createStorageDriver } from "../src/storage/storage.service";
import { assertSafeKey, keyFromUrl } from "../src/storage/storage.types";

// PNG 1×1 réel (pixel rouge).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
// En-tête JPEG minimal : SOI, APP0 (JFIF), SOF0 annonçant 640×480.
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from("JFIF\0"), Buffer.from([1, 1, 0, 0, 1, 0, 1, 0, 0]),
  Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]),
  Buffer.from([0xff, 0xd9]),
]);
// En-tête WebP étendu (VP8X) annonçant 800×600.
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x16, 0, 0, 0]), Buffer.from("WEBPVP8X"), Buffer.from([0x0a, 0, 0, 0, 0, 0, 0, 0]), Buffer.from([0x1f, 0x03, 0x00, 0x57, 0x02, 0x00])]);

const codeOf = (fn: () => unknown) => { try { fn(); } catch (e) { return e instanceof ImageValidationError ? e.code : `autre: ${e}`; } return "aucune erreur"; };

describe("validation des images", () => {
  it("reconnaît JPEG, PNG et WebP à leurs octets magiques", () => {
    expect(sniffImage(PNG)).toEqual({ mime: "image/png", ext: "png" });
    expect(sniffImage(JPEG)).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(sniffImage(WEBP)).toEqual({ mime: "image/webp", ext: "webp" });
  });

  it("refuse ce qui n'est pas une image, quel que soit le nom ou le type annoncé", () => {
    for (const bad of [Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), Buffer.from("GIF89a\x01\x00\x01\x00"), Buffer.from("%PDF-1.7\n"), Buffer.from("<?php echo 1; ?>"), Buffer.from("MZ\x90\x00"), Buffer.from("RIFF\x00\x00\x00\x00WAVEfmt ")]) {
      expect(sniffImage(bad)).toBeNull();
      expect(codeOf(() => validateImage(bad))).toBe("unsupported_type");
    }
  });

  it("refuse un fichier vide ou absent", () => {
    expect(codeOf(() => validateImage(Buffer.alloc(0)))).toBe("empty");
    expect(codeOf(() => validateImage(undefined))).toBe("empty");
  });

  it("accepte exactement 5 Mo et refuse un octet de plus", () => {
    const atLimit = Buffer.alloc(MAX_IMAGE_BYTES); PNG.copy(atLimit);
    expect(validateImage(atLimit).size).toBe(MAX_IMAGE_BYTES);
    const over = Buffer.alloc(MAX_IMAGE_BYTES + 1); PNG.copy(over);
    expect(codeOf(() => validateImage(over))).toBe("too_large");
  });

  it("lit les dimensions dans l'en-tête", () => {
    expect(validateImage(PNG)).toEqual({ mime: "image/png", ext: "png", size: PNG.length, width: 1, height: 1 });
    expect(imageDimensions(JPEG, { mime: "image/jpeg", ext: "jpg" })).toEqual({ width: 640, height: 480 });
    expect(imageDimensions(WEBP, { mime: "image/webp", ext: "webp" })).toEqual({ width: 800, height: 600 });
    // En-tête tronqué : pas de dimensions, mais pas d'exception non plus.
    expect(validateImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toMatchObject({ mime: "image/jpeg", width: null, height: null });
  });

  it("limite à 12 photos par mosquée", () => {
    expect(MAX_PHOTOS_PER_MOSQUE).toBe(12);
    expect(() => assertUnderLimit(11, "photo")).not.toThrow();
    expect(codeOf(() => assertUnderLimit(12, "photo"))).toBe("limit_reached");
    expect(() => assertUnderLimit(12, "announcement_image")).not.toThrow();
  });

  it("construit des clés mosques/<id>/<uuid>.<ext> et rejette les clés dangereuses", () => {
    expect(mediaKey("m1", "u-1", "jpg")).toBe("mosques/m1/u-1.jpg");
    expect(assertSafeKey("mosques/m1/u-1.jpg")).toBe("mosques/m1/u-1.jpg");
    for (const bad of ["../etc/passwd", "mosques/../../x.png", "/abs/x.png", "mosques//x.png", "mosques/m1/x.png?y", "mosques\\x.png", ""]) expect(() => assertSafeKey(bad)).toThrow();
  });

  it("retrouve la clé depuis une URL publique des deux pilotes", () => {
    expect(keyFromUrl("http://localhost:4000/v1/files/mosques/abc-1/f0e1.png")).toBe("mosques/abc-1/f0e1.png");
    expect(keyFromUrl("https://x.supabase.co/storage/v1/object/public/nidaa-media/mosques/abc-1/f0e1.webp")).toBe("mosques/abc-1/f0e1.webp");
    expect(keyFromUrl("https://exemple.dj/ailleurs/photo.jpg")).toBeNull();
  });
});

describe("pilote local", () => {
  let dir: string;
  let driver: LocalStorageDriver;
  beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), "nidaa-storage-")); driver = new LocalStorageDriver({ dir, publicBaseUrl: "http://localhost:4000/" }); });
  afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

  it("écrit le fichier sous le dossier racine et renvoie l'URL /v1/files/<clé>", async () => {
    const url = await driver.put("mosques/m1/a.png", PNG, "image/png");
    expect(url).toBe("http://localhost:4000/v1/files/mosques/m1/a.png");
    expect(await readFile(join(dir, "mosques/m1/a.png"))).toEqual(PNG);
  });

  it("supprime le fichier, sans erreur s'il est déjà absent", async () => {
    await driver.put("mosques/m1/b.png", PNG, "image/png");
    await driver.remove("mosques/m1/b.png");
    await expect(stat(join(dir, "mosques/m1/b.png"))).rejects.toThrow();
    await expect(driver.remove("mosques/m1/b.png")).resolves.toBeUndefined();
  });

  it("refuse de sortir du dossier racine", async () => {
    await expect(driver.put("../dehors.png", PNG, "image/png")).rejects.toThrow(/invalide/);
    expect(() => driver.pathFor("mosques/../../dehors.png")).toThrow(/invalide/);
  });
});

describe("pilote Supabase (client HTTP simulé)", () => {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: Uint8Array | string }> = [];
  let status = 200;
  const fetchImpl: FetchLike = async (url, init) => { calls.push({ url, method: init.method, headers: init.headers, body: init.body }); return { ok: status < 300, status, text: async () => (status < 300 ? "{}" : '{"message":"refusé"}') }; };
  const driver = new SupabaseStorageDriver({ url: "https://abcd.supabase.co/", serviceRoleKey: "service-key", bucket: "nidaa-media", fetchImpl });

  it("envoie l'objet : POST /storage/v1/object/<compartiment>/<clé>, type de contenu et clé de service", async () => {
    calls.length = 0; status = 200;
    const url = await driver.put("mosques/m1/a.jpg", JPEG, "image/jpeg");
    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.method).toBe("POST");
    expect(c.url).toBe("https://abcd.supabase.co/storage/v1/object/nidaa-media/mosques/m1/a.jpg");
    expect(c.headers).toMatchObject({ authorization: "Bearer service-key", apikey: "service-key", "content-type": "image/jpeg", "x-upsert": "true" });
    expect(Buffer.from(c.body as Uint8Array)).toEqual(JPEG);
    expect(url).toBe("https://abcd.supabase.co/storage/v1/object/public/nidaa-media/mosques/m1/a.jpg");
  });

  it("supprime l'objet : DELETE /storage/v1/object/<compartiment> avec { prefixes: [clé] }", async () => {
    calls.length = 0; status = 200;
    await driver.remove("mosques/m1/a.jpg");
    expect(calls[0]).toMatchObject({ method: "DELETE", url: "https://abcd.supabase.co/storage/v1/object/nidaa-media" });
    expect(JSON.parse(calls[0]!.body as string)).toEqual({ prefixes: ["mosques/m1/a.jpg"] });
    expect(calls[0]!.headers.authorization).toBe("Bearer service-key");
  });

  it("remonte une erreur lisible si Supabase refuse l'envoi, et tolère un 404 à la suppression", async () => {
    status = 403;
    await expect(driver.put("mosques/m1/a.jpg", JPEG, "image/jpeg")).rejects.toThrow(/403/);
    status = 404;
    await expect(driver.remove("mosques/m1/a.jpg")).resolves.toBeUndefined();
  });

  it("se construit depuis l'environnement et exige ses variables", () => {
    const d = createStorageDriver({ STORAGE_DRIVER: "supabase", SUPABASE_URL: "https://abcd.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" });
    expect(d.name).toBe("supabase");
    expect(d.publicUrl("mosques/m/x.png")).toBe("https://abcd.supabase.co/storage/v1/object/public/nidaa-media/mosques/m/x.png");
    expect(() => createStorageDriver({ STORAGE_DRIVER: "supabase", SUPABASE_URL: "https://abcd.supabase.co" })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => createStorageDriver({ STORAGE_DRIVER: "s3" })).toThrow(/STORAGE_DRIVER/);
    expect(createStorageDriver({}).name).toBe("local");
  });
});
