import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import type { z } from "zod";
import type { AuthTokens, LoginSchema, Me, MemberRole, MosqueStatus, RegisterSchema } from "@nidaa/shared";
import { PrismaService } from "../prisma/prisma.service";
import { parseTtlSeconds, randomToken, sha256 } from "../common/utils";

type RegisterInput = z.infer<typeof RegisterSchema>;
type LoginInput = z.infer<typeof LoginSchema>;

@Injectable()
export class AuthService {
  private readonly accessTtl = parseTtlSeconds(process.env.JWT_ACCESS_TTL, 15 * 60);
  private readonly refreshTtl = parseTtlSeconds(process.env.JWT_REFRESH_TTL, 30 * 86400);

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(input: RegisterInput, userAgent?: string): Promise<{ user: Me; tokens: AuthTokens }> {
    const email = input.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException("Un compte existe déjà avec cet e-mail");
    const user = await this.prisma.user.create({
      data: { email, passwordHash: await argon2.hash(input.password), fullName: input.fullName, phone: input.phone, locale: input.locale },
    });
    return { user: await this.me(user.id), tokens: await this.issueTokens(user.id, userAgent) };
  }

  async login(input: LoginInput, userAgent?: string): Promise<{ user: Me; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) throw new UnauthorizedException("Identifiants invalides");
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { user: await this.me(user.id), tokens: await this.issueTokens(user.id, userAgent) };
  }

  /** Rotation : l'ancien jeton est révoqué, un nouveau couple est émis. */
  async refresh(refreshToken: string, userAgent?: string): Promise<AuthTokens> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!row || row.revokedAt || row.expiresAt < new Date()) throw new UnauthorizedException("Jeton de rafraîchissement invalide");
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(row.userId, userAgent);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(userId: string): Promise<Me> {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { include: { mosque: { select: { id: true, name: true, slug: true, status: true } } }, orderBy: { createdAt: "asc" } } },
    });
    return {
      id: u.id, email: u.email, fullName: u.fullName, locale: u.locale, isSuperAdmin: u.isSuperAdmin,
      memberships: u.memberships.map((m) => ({ mosqueId: m.mosqueId, role: m.role as MemberRole, mosqueName: m.mosque.name, slug: m.mosque.slug, status: m.mosque.status as MosqueStatus })),
    };
  }

  private async issueTokens(userId: string, userAgent?: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, isSuperAdmin: true } });
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, sa: user.isSuperAdmin }, { expiresIn: this.accessTtl });
    const refreshToken = randomToken(48);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: sha256(refreshToken), userAgent: userAgent?.slice(0, 200), expiresAt: new Date(Date.now() + this.refreshTtl * 1000) },
    });
    return { accessToken, refreshToken, expiresIn: this.accessTtl };
  }
}
