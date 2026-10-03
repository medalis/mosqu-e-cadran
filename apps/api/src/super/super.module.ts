import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SuperService } from "./super.service";
import { SuperController } from "./super.controller";

@Module({ imports: [AuthModule], controllers: [SuperController], providers: [SuperService] })
export class SuperModule {}
