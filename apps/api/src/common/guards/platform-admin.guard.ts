import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthContext } from '../decorators/current-user.decorator';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthContext | undefined;
    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException(
        'Platform Super-Admin access required. Add your email to PLATFORM_ADMIN_EMAILS in .env.',
      );
    }
    return true;
  }
}
