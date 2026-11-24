import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';

export async function logEvent(
  type: string,
  entityType?: string,
  entityId?: number,
  payload?: Prisma.InputJsonValue,
) {
  return prisma.eventLog.create({
    data: { type, entityType, entityId, payload },
  });
}
