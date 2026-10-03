import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import type { ZodTypeAny } from "zod";

/** Valide et normalise (defaults Zod) le corps/les paramètres avec un schéma de @nidaa/shared. */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}
  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join(".") || "(racine)"}: ${i.message}`);
      throw new BadRequestException({ statusCode: 400, message: issues, error: "Validation" });
    }
    return result.data;
  }
}

export const zodBody = (schema: ZodTypeAny) => new ZodValidationPipe(schema);
