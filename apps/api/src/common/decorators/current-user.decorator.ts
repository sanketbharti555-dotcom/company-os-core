import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthContext {
  userId: string;
  email: string;
  tenantId: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  isOwner: boolean;
  setupStatus: string | null;
  isPlatformAdmin?: boolean;
  authType?: 'USER_JWT' | 'MODULE_TOKEN';
  moduleKey?: string;
  scopes?: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
