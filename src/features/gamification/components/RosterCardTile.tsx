// Feature 003 · US4 · T094 — cartão compacto por atleta na grade do elenco.
// Atrás da consulta de elenco existente, sem novos dados: reusa a RPC
// `athlete_card`. Se o cartão não carregar, cai para a identidade da linha do
// elenco (foto/nome/posição) em estado incompleto, sem quebrar a grade.

import { useQuery } from '@tanstack/react-query';

import type { AthleteCard, GamificationService } from '../api/gamification.service';
import { createGamificationService, gamificationKeys } from '../api/gamification.service';
import { AttributeCard } from './AttributeCard';

const defaultService = createGamificationService();

interface RosterCardTileProps {
  athleteId: string;
  fallbackName: string;
  fallbackPosition: string;
  fallbackShirtNumber: number;
  avatarUrl?: string | null;
  service?: GamificationService;
}

export function RosterCardTile({
  athleteId,
  avatarUrl,
  fallbackName,
  fallbackPosition,
  fallbackShirtNumber,
  service = defaultService,
}: RosterCardTileProps) {
  const query = useQuery({
    enabled: athleteId.length > 0,
    queryFn: () => service.getAthleteCard(athleteId),
    queryKey: gamificationKeys.athleteCard(athleteId),
    retry: false,
    staleTime: 60_000,
  });

  const card: AthleteCard = query.data ?? {
    athleteId,
    defending: null,
    dribbling: null,
    incomplete: true,
    overall: null,
    pace: null,
    passing: null,
    photoPath: null,
    physical: null,
    primaryPosition: fallbackPosition,
    shirtName: fallbackName,
    shirtNumber: fallbackShirtNumber,
    shooting: null,
  };

  return <AttributeCard avatarUrl={avatarUrl ?? null} card={card} variant="compact" />;
}
