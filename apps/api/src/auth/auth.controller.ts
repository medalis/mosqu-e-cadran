import { Body, Controller, Get, Headers, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { LoginSchema, RegisterSchema } from "@nidaa/shared";
import { AuthService } from "./auth.service";
import { zodBody } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser, type AuthUser } from "../common/decorators";

const RefreshBody = z.object({ refreshToken: z.string().min(10) });

@ApiTags("auth")
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("auth/register")
  register(@Body(zodBody(RegisterSchema)) body: z.infer<typeof RegisterSchema>, @Headers("user-agent") ua?: string) {
    return this.auth.register(body, ua);
  }

  @Post("auth/login")
  @HttpCode(200)
  login(@Body(zodBody(LoginSchema)) body: z.infer<typeof LoginSchema>, @Headers("user-agent") ua?: string) {
    return this.auth.login(body, ua);
  }

  @Post("auth/refresh")
  @HttpCode(200)
  refresh(@Body(zodBody(RefreshBody)) body: z.infer<typeof RefreshBody>, @Headers("user-agent") ua?: string) {
    return this.auth.refresh(body.refreshToken, ua);
  }

  @Post("auth/logout")
  @HttpCode(204)
  async logout(@Body(zodBody(RefreshBody)) body: z.infer<typeof RefreshBody>) {
    await this.auth.logout(body.refreshToken);
  }

  @Get("me")
  @ApiBearerAuth("jwt")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
