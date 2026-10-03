import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { IqamaRulesSchema, ScreenSettingsSchema } from "@nidaa/shared";
import { ZodValidationPipe } from "../src/common/zod-validation.pipe";

describe("ZodValidationPipe", () => {
  it("applique les valeurs par défaut", () => {
    const out = new ZodValidationPipe(ScreenSettingsSchema).transform({ theme: "emeraude" }, { type: "body" });
    expect(out.theme).toBe("emeraude");
    expect(out.languages).toEqual(["fr", "ar"]);
    expect(out.durations.prayer.maghrib).toBe(8);
  });
  it("rejette un corps invalide avec un 400 lisible", () => {
    expect(() => new ZodValidationPipe(IqamaRulesSchema).transform([{ prayer: "fajr", mode: "delay" }], { type: "body" })).toThrow(BadRequestException);
  });
});
