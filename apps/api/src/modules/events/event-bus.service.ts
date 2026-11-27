import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import crypto from 'crypto';

export interface PublishEventInput {
  tenantId: string;
  eventName: string;
  actorEmployeeId: string;
  sourceModule: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

@Injectable()
export class EventBusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: EventEmitter2,
  ) {}

  /**
   * Transactional Outbox write + asynchronous in-process relay.
   * All Core services and docked Plugins publish events through this single method.
   */
  async publish(input: PublishEventInput) {
    const correlationId = input.correlationId || `cor-${crypto.randomUUID().slice(0, 8)}`;

    const outbox = await this.prisma.eventOutbox.create({
      data: {
        tenantId: input.tenantId,
        eventName: input.eventName,
        version: 1,
        actorEmployeeId: input.actorEmployeeId,
        sourceModule: input.sourceModule,
        correlationId,
        payloadJson: input.payload as object,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    const envelope = {
      event_id: outbox.id,
      event_name: outbox.eventName,
      version: outbox.version,
      tenant_id: outbox.tenantId,
      occurred_at: outbox.occurredAt.toISOString(),
      actor_employee_id: outbox.actorEmployeeId,
      source_module: outbox.sourceModule,
      correlation_id: outbox.correlationId,
      payload: input.payload,
    };

    // Emit canonical event name + wildcard for Sheets mirror & KPI subscribers
    this.emitter.emit(input.eventName, envelope);
    this.emitter.emit('companyos.event.*', envelope);

    return outbox;
  }

  /** Idempotent consumer guard using EventInbox */
  async claimInbox(tenantId: string, eventId: string, consumerKey: string): Promise<boolean> {
    try {
      await this.prisma.eventInbox.create({
        data: { tenantId, eventId, consumerKey },
      });
      return true;
    } catch {
      return false; // Already processed
    }
  }
}
