import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { GoogleSheetsService } from '../sheets/google-sheets.service';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly sheetsService: GoogleSheetsService,
  ) {}

  async list(tenantId: string, search?: string) {
    return this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Synchronously generates canonical Student ID (STU-2026-000001) so CRM can print
   * Admission PDF immediately, then publishes `student.created` event to Event Bus.
   */
  async create(
    tenantId: string,
    actorEmpCode: string,
    dto: {
      fullName: string;
      phone: string;
      email?: string;
      productId?: string;
      leadId?: string;
      guardianName?: string;
      guardianPhone?: string;
    },
  ) {
    const year = new Date().getFullYear();
    const count = await this.prisma.student.count({ where: { tenantId } });
    const code = `STU-${year}-${String(count + 1).padStart(6, '0')}`;

    const student = await this.prisma.student.create({
      data: {
        tenantId,
        code,
        fullName: dto.fullName.trim(),
        phone: dto.phone.trim(),
        email: dto.email?.trim() || null,
        productId: dto.productId || null,
        leadId: dto.leadId || null,
        guardianName: dto.guardianName?.trim() || null,
        guardianPhone: dto.guardianPhone?.trim() || null,
        status: 'ADMITTED',
      },
    });

    await this.eventBus.publish({
      tenantId,
      eventName: 'student.created',
      actorEmployeeId: actorEmpCode,
      sourceModule: 'core',
      payload: {
        student_id: student.code,
        lead_id: student.leadId,
        product_id: student.productId,
        full_name: student.fullName,
      },
    });

    await this.sheetsService.enqueueSync(tenantId, 'core', 'students').catch(() => {});
    return student;
  }
}
