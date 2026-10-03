import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { MosqueRoleGuard } from "./guards/mosque-role.guard";
import { DeviceAuthGuard } from "./guards/device-auth.guard";

@Module({
  imports: [PassportModule.register({ defaultStrategy: "jwt" }), JwtModule.register({ secret: process.env.JWT_SECRET ?? "change-me-in-production" })],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, SuperAdminGuard, MosqueRoleGuard, DeviceAuthGuard],
  exports: [AuthService, JwtAuthGuard, SuperAdminGuard, MosqueRoleGuard, DeviceAuthGuard, JwtModule, PassportModule],
})
export class AuthModule {}
