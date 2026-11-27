import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthContext } from '../decorators/current-user.decorator';

/**
 * Automatically records an immutable AuditLog entry for every POST/PATCH/PUT/DELETE mutation.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = req.method as string;
    const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);

    return next.handle().pipe(
      tap(async (responseBody) => {
        if (!isMutation) return;
        const user = req.user as AuthContext | undefined;
        if (!user?.tenantId) return;

        try {
          await this.prisma.auditLog.create({
            data: {
              tenantId: user.tenantId,
              actorEmployeeId: user.employeeCode || user.email,
              action: `${method} ${req.route?.path || req.url}`,
              resource: String(req.url).split('?')[0],
              resourceId:
                (responseBody as { id?: string; code?: string })?.id ||
                (responseBody as { code?: string })?.code ||
                req.params?.id ||
                null,
              newValueJson: req.body ? JSON.parse(JSON.stringify(req.body)) : undefined,
              ipAddress: req.ip || null,
              correlationId: String(req.headers['x-correlation-id'] || ''),
            },
          });
        } catch {
          // Audit failure should never crash an already-committed request
        }
      }),
    );
  }
}
