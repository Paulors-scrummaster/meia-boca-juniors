import { z } from 'zod';

export interface GoalValues {
  assistantAthleteId: string | null;
  isOpponentOwnGoal: boolean;
  scorerAthleteId: string | null;
  sequence: number;
}

export interface ConsolidationValues {
  goals: GoalValues[];
  mbjScore: number;
  opponentScore: number;
}

const nullableUuid = z.string().uuid().nullable();

const goalSchema: z.ZodType<GoalValues> = z
  .object({
    assistantAthleteId: nullableUuid,
    isOpponentOwnGoal: z.boolean(),
    scorerAthleteId: nullableUuid,
    sequence: z.number().int().positive(),
  })
  .superRefine((goal, context) => {
    if (goal.isOpponentOwnGoal) {
      if (goal.scorerAthleteId !== null) {
        context.addIssue({
          code: 'custom',
          message: 'Gol contra do adversário não possui autor do MBJ.',
          path: ['scorerAthleteId'],
        });
      }
      if (goal.assistantAthleteId !== null) {
        context.addIssue({
          code: 'custom',
          message: 'Gol contra do adversário não possui assistência.',
          path: ['assistantAthleteId'],
        });
      }
      return;
    }
    if (!goal.scorerAthleteId) {
      context.addIssue({
        code: 'custom',
        message: 'Informe o autor do gol.',
        path: ['scorerAthleteId'],
      });
    }
    if (goal.scorerAthleteId && goal.assistantAthleteId === goal.scorerAthleteId) {
      context.addIssue({
        code: 'custom',
        message: 'Autor e assistência devem ser atletas diferentes.',
        path: ['assistantAthleteId'],
      });
    }
  });

export const consolidationSchema: z.ZodType<ConsolidationValues> = z
  .object({
    goals: z.array(goalSchema),
    mbjScore: z
      .number({ invalid_type_error: 'Informe o placar do MBJ.' })
      .int('Use um placar inteiro.')
      .min(0, 'O placar não pode ser negativo.')
      .max(99, 'Use um placar de até 99 gols.'),
    opponentScore: z
      .number({ invalid_type_error: 'Informe o placar do adversário.' })
      .int('Use um placar inteiro.')
      .min(0, 'O placar não pode ser negativo.')
      .max(99, 'Use um placar de até 99 gols.'),
  })
  .superRefine((values, context) => {
    if (values.goals.length !== values.mbjScore) {
      context.addIssue({
        code: 'custom',
        message: 'A quantidade de contribuições deve ser igual ao placar do MBJ.',
        path: ['goals'],
      });
    }
  });
