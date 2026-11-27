import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { google } from 'googleapis';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { randomBytes } from 'crypto';

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/contacts.readonly',
];

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private crypto: EncryptionService,
  ) {}

  async validateOAuthUser(profile: GoogleUserInfo) {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.id },
    });

    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.id, avatarUrl: profile.picture },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            googleId: profile.id,
            avatarUrl: profile.picture,
          },
        });
      }
    }

    return user;
  }

  async storeOAuthTokens(
    userId: string,
    tokens: {
      access_token?: string | null;
      refresh_token?: string | null;
      expiry_date?: number | null;
    },
  ) {
    const existing = await this.prisma.oAuthToken.findUnique({
      where: { userId_provider: { userId, provider: 'google' } },
    });

    const encryptedAccessToken = tokens.access_token
      ? this.crypto.encrypt(tokens.access_token)
      : existing?.accessToken;

    const encryptedRefreshToken = tokens.refresh_token
      ? this.crypto.encrypt(tokens.refresh_token)
      : existing?.refreshToken;

    if (!encryptedAccessToken) {
      throw new BadRequestException('Access token is required');
    }

    return this.prisma.oAuthToken.upsert({
      where: { userId_provider: { userId, provider: 'google' } },
      update: {
        accessToken: encryptedAccessToken,
        ...(encryptedRefreshToken && { refreshToken: encryptedRefreshToken }),
        expiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
      },
      create: {
        userId,
        provider: 'google',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
      },
    });
  }

  async getGoogleOAuthClient(userId: string) {
    const tokenRecord = await this.prisma.oAuthToken.findUnique({
      where: { userId_provider: { userId, provider: 'google' } },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Google account not connected');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    const decryptedAccessToken = this.crypto.decrypt(tokenRecord.accessToken);
    const decryptedRefreshToken = tokenRecord.refreshToken
      ? this.crypto.decrypt(tokenRecord.refreshToken)
      : undefined;

    oauth2Client.setCredentials({
      access_token: decryptedAccessToken,
      refresh_token: decryptedRefreshToken,
      expiry_date: tokenRecord.expiresAt?.getTime(),
    });

    return oauth2Client;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = randomBytes(32).toString('hex');

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.crypto.sha256(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
    };
  }

  async refreshTokens(refreshToken: string) {
    const tokenHash = this.crypto.sha256(refreshToken);
    const savedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!savedToken || savedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.delete({
      where: { id: savedToken.id },
    });

    const newAccessToken = this.jwtService.sign({
      email: savedToken.user.email,
      sub: savedToken.userId,
    });
    const newRefreshToken = randomBytes(32).toString('hex');

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.crypto.sha256(newRefreshToken),
        userId: savedToken.userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }
}
