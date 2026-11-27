import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ModuleTokenGuard } from './module-token.guard';

/**
 * Accepts EITHER a User JWT (web/mobile app) OR a Scoped Module Token (docked plugin).
 */
@Injectable()
export class HybridAuthGuard implements CanActivate {
  constructor(
    private readonly jwtGuard: JwtAuthGuard,
    private readonly moduleTokenGuard: ModuleTokenGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = String(req.headers['authorization'] || '');
    if (authHeader.startsWith('Bearer cos_mod_')) {
      return this.moduleTokenGuard.canActivate(context);
    }
    return (await this.jwtGuard.canActivate(context)) as boolean;
  }
}
