import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(
    @Body() body: { fullName: string; email: string; password: string; phone?: string },
  ) {
    return this.authService.signup(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body);
  }

  @Get('google')
  getGoogleUrl() {
    return this.authService.getGoogleAuthUrl();
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      const result = await this.authService.handleGoogleCallback(code);
      const redirectUrl = `${frontendUrl}/auth/google/callback?accessToken=${encodeURIComponent(
        result.accessToken,
      )}&refreshToken=${encodeURIComponent(result.refreshToken)}`;
      return res.redirect(redirectUrl);
    } catch (err) {
      const msg = encodeURIComponent((err as Error).message || 'Google login failed');
      return res.redirect(`${frontendUrl}/auth/login?error=${msg}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthContext) {
    return this.authService.getMe(user.userId, user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-org')
  switchOrg(@CurrentUser() user: AuthContext, @Body() body: { tenantId: string }) {
    return this.authService.switchOrganization(user.userId, body.tenantId);
  }
}
