import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthContext } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'change-me-super-secret-access-key-min-32-chars',
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    tenantId: string | null;
    employeeId: string | null;
    employeeCode: string | null;
    isOwner: boolean;
    setupStatus: string | null;
    isPlatformAdmin?: boolean;
  }): Promise<AuthContext> {
    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      employeeId: payload.employeeId,
      employeeCode: payload.employeeCode,
      isOwner: payload.isOwner,
      setupStatus: payload.setupStatus,
      isPlatformAdmin: Boolean(payload.isPlatformAdmin),
      authType: 'USER_JWT',
    };
  }
}
