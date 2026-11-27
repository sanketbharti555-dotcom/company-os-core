import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { GoogleSheetsService } from '../sheets/google-sheets.service';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly sheetsService: GoogleSheetsService,
  ) {}

  async list(tenantId: string, roleTag?: string) {
    return this.prisma.employee.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(roleTag ? { roleTags: { has: roleTag } } : {}),
      },
      include: { department: true },
      orderBy: { code: 'asc' },
    });
  }

  async create(
    tenantId: string,
    actorEmpCode: string,
    dto: {
      fullName: string;
      email: string;
      phone: string;
      departmentId?: string;
      designation?: string;
      employmentType?: string;
      roleTags?: string[];
    },
  ) {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.employee.findFirst({
      where: { tenantId, email, deletedAt: null },
    });
    if (exists) throw new BadRequestException('Employee with this email already exists.');

    const count = await this.prisma.employee.count({ where: { tenantId } });
    const code = `EMP-${String(count + 1).padStart(4, '0')}`;

    const emp = await this.prisma.employee.create({
      data: {
        tenantId,
        code,
        fullName: dto.fullName.trim(),
        email,
        phone: dto.phone.trim(),
        departmentId: dto.departmentId || null,
        designation: dto.designation || null,
        employmentType: dto.employmentType || 'FULL_TIME',
        roleTags: dto.roleTags || [],
        status: 'ACTIVE',
      },
      include: { department: true },
    });

    await this.eventBus.publish({
      tenantId,
      eventName: 'employee.created',
      actorEmployeeId: actorEmpCode,
      sourceModule: 'core',
      payload: { employee_id: emp.code, full_name: emp.fullName, role_tags: emp.roleTags },
    });

    await this.sheetsService.enqueueSync(tenantId, 'core', 'employees').catch(() => {});
    return emp;
  }

  async deactivate(tenantId: string, id: string, actorEmpCode: string) {
    const emp = await this.prisma.employee.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    await this.eventBus.publish({
      tenantId,
      eventName: 'employee.deactivated',
      actorEmployeeId: actorEmpCode,
      sourceModule: 'core',
      payload: { employee_id: emp.code },
    });
    await this.sheetsService.enqueueSync(tenantId, 'core', 'employees').catch(() => {});
    return emp;
  }

  async listDepartments(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId, deletedAt: null },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(
    tenantId: string,
    dto: { name: string; code?: string; headEmployeeId?: string },
  ) {
    const code =
      dto.code || `DEPT-${dto.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}`;
    const dept = await this.prisma.department.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        code,
        headEmployeeId: dto.headEmployeeId || null,
      },
    });
    await this.sheetsService.enqueueSync(tenantId, 'core', 'departments').catch(() => {});
    return dept;
  }
}
