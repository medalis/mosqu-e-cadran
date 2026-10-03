import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { AdminMutationInterceptor } from "./admin-mutation.interceptor";

@Global()
@Module({ providers: [AuditService, AdminMutationInterceptor], exports: [AuditService, AdminMutationInterceptor] })
export class CommonModule {}
