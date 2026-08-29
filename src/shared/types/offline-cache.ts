import { z } from 'zod';

const isoDateTime = z.string().datetime({ offset: true });

export const offlineNextMatchSchema = z
  .object({
    schemaVersion: z.literal(1),
    cachedAt: isoDateTime,
    match: z
      .object({
        id: z.string().uuid(),
        opponentName: z.string().min(1).max(120),
        matchDate: isoDateTime,
        locationName: z.string().max(160).nullable(),
        competitionName: z.string().max(120).nullable(),
        status: z.literal('SCHEDULED'),
      })
      .strict(),
    myCall: z
      .object({
        callStatus: z.enum(['CALLED', 'NOT_CALLED']),
        presenceStatus: z.enum(['PENDING', 'CONFIRMED', 'DECLINED']).nullable(),
        applicableDeadline: isoDateTime.nullable(),
      })
      .strict(),
  })
  .strict();

const offlineStarterSchema = z
  .object({
    athleteId: z.string().uuid(),
    shirtName: z.string().min(1).max(40),
    shirtNumber: z.number().int().min(1).max(99),
    tacticalPosition: z.string().min(1).max(30),
    positionX: z.number().min(0).max(100),
    positionY: z.number().min(0).max(100),
  })
  .strict();

const offlineReserveSchema = z
  .object({
    athleteId: z.string().uuid(),
    shirtName: z.string().min(1).max(40),
    shirtNumber: z.number().int().min(1).max(99),
    displayOrder: z.number().int().nonnegative(),
  })
  .strict();

export const offlinePublishedLineupSchema = z
  .object({
    schemaVersion: z.literal(1),
    cachedAt: isoDateTime,
    matchId: z.string().uuid(),
    lineup: z
      .object({
        revision: z.number().int().positive(),
        formationCode: z.string().min(1).max(20),
        publishedAt: isoDateTime,
        starters: z.array(offlineStarterSchema),
        reserves: z.array(offlineReserveSchema),
      })
      .strict(),
  })
  .strict();

export type OfflineNextMatch = z.infer<typeof offlineNextMatchSchema>;
export type OfflinePublishedLineup = z.infer<typeof offlinePublishedLineupSchema>;
export type OfflineSnapshot = OfflineNextMatch | OfflinePublishedLineup;
