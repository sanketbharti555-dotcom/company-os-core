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

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly crypto: EncryptionService,
  ) {}

  private createOAuthClient(redirectUri?: string) {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri ||
        process.env.GOOGLE_OAUTH_REDIRECT_URI ||
        'http://localhost:4000/api/v1/auth/google/callback',
    );
  }

  async signup(dto: { fullName: string; email: string; password: string; phone?: string }) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email,
        phone: dto.phone?.trim() || null,
        passwordHash,
      },
    });

    return this.issueTokensForUser(user.id, null);
  }

  async login(dto: { email: string; password: string }) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return this.issueTokensForUser(user.id, null);
  }

  /**
   * Generates Google Sign-In URL that ALSO requests Drive + Sheets least-privilege scopes
   * so the user's Google Drive folder can be created automatically during Organization Setup!
   */
  getGoogleAuthUrl() {
    const oauth2Client = this.createOAuthClient();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_OAUTH_SCOPES,
    });
    return { url };
  }

  async handleGoogleCallback(code: string) {
    const oauth2Client = this.createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      throw new UnauthorizedException('Google account email could not be verified.');
    }

    const email = profile.email.toLowerCase();
    const accessEnc = tokens.access_token ? this.crypto.encrypt(tokens.access_token) : undefined;
    const refreshEnc = tokens.refresh_token ? this.crypto.encrypt(tokens.refresh_token) : undefined;
    const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        googleId: profile.id || undefined,
        avatarUrl: profile.picture || undefined,
        ...(accessEnc ? { googleAccessTokenEnc: accessEnc } : {}),
        ...(refreshEnc ? { googleRefreshTokenEnc: refreshEnc } : {}),
        ...(tokenExpiry ? { googleTokenExpiry: tokenExpiry } : {}),
      },
      create: {
        email,
        fullName: profile.name || email.split('@')[0],
        googleId: profile.id || null,
        avatarUrl: profile.picture || null,
        googleAccessTokenEnc: accessEnc || null,
        googleRefreshTokenEnc: refreshEnc || null,
        googleTokenExpiry: tokenExpiry || null,
      },
    });

    return this.issueTokensForUser(user.id, null);
  }

  async issueTokensForUser(userId: string, preferredTenantId: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { tenant: true, employee: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive.');
    }

    const activeMembership =
      (preferredTenantId
        ? user.memberships.find((m) => m.tenantId === preferredTenantId)
        : user.memberships[0]) || null;

    const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const isPlatformAdmin = Boolean(user.isPlatformAdmin || adminEmails.includes(user.email.toLowerCase()));

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: activeMembership?.tenantId || null,
      employeeId: activeMembership?.employee?.id || null,
      employeeCode: activeMembership?.employee?.code || null,
      isOwner: activeMembership?.isOwner || false,
      setupStatus: activeMembership?.tenant?.setupStatus || null,
      isPlatformAdmin,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET || 'change-me-super-secret-access-key-min-32-chars',
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      {
        secret: process.env.JWT_REFRESH_SECRET || 'change-me-super-secret-refresh-key-min-32-chars',
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.crypto.sha256(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        hasGoogleConnected: Boolean(user.googleRefreshTokenEnc || user.googleAccessTokenEnc),
        isPlatformAdmin,
      },
      activeOrganization: activeMembership
        ? {
            id: activeMembership.tenant.id,
            code: activeMembership.tenant.code,
            name: activeMembership.tenant.name,
            slug: activeMembership.tenant.slug,
            setupStatus: activeMembership.tenant.setupStatus,
            isOwner: activeMembership.isOwner,
            employeeCode: activeMembership.employee?.code || null,
          }
        : null,
      organizations: user.memberships.map((m) => ({
        id: m.tenant.id,
        code: m.tenant.code,
        name: m.tenant.name,
        slug: m.tenant.slug,
        setupStatus: m.tenant.setupStatus,
        isOwner: m.isOwner,
        employeeCode: m.employee?.code || null,
      })),
    };
  }

  async switchOrganization(userId: string, tenantId: string) {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('You do not belong to this organization.');
    }
    return this.issueTokensForUser(userId, tenantId);
  }

  async getMe(userId: string, tenantId: string | null) {
    return this.issueTokensForUser(userId, tenantId);
  }
}
