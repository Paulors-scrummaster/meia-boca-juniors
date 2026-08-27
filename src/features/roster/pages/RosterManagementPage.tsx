import { useNavigate, useParams } from 'react-router-dom';

import { AthleteForm } from '@/features/roster/components/AthleteForm';
import { useAthlete } from '@/features/roster/queries/roster.queries';
import { ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';

export function CreateAthletePage() {
  const navigate = useNavigate();
  return (
    <AthleteForm onSaved={(athlete) => navigate(`/app/roster/${athlete.id}`, { replace: true })} />
  );
}

export function EditAthletePage() {
  const navigate = useNavigate();
  const { athleteId = '' } = useParams();
  const query = useAthlete(athleteId);
  if (query.isPending) return <LoadingState label="Carregando atleta" />;
  if (query.isError)
    return (
      <ErrorState title="Atleta não encontrado" message={mapToAppError(query.error).message} />
    );
  return (
    <AthleteForm
      athlete={query.data}
      onSaved={(athlete) => navigate(`/app/roster/${athlete.id}`, { replace: true })}
    />
  );
}
