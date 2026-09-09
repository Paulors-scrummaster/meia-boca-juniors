import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AthleteCard } from '@/features/gamification/api/gamification.service';
import { AttributeCard } from '@/features/gamification/components/AttributeCard/AttributeCard';
import {
  ATTRIBUTE_COLUMNS,
  ATTRIBUTE_SIGLA,
  abbreviatePosition,
} from '@/features/gamification/components/AttributeCard/attributeCard.constants';

// Feature 003 · US4 · T089a — cartão do atleta (mapeamento de siglas, abreviação
// de posição, `overall` verbatim, estado incompleto).

function makeCard(overrides: Partial<AthleteCard> = {}): AthleteCard {
  return {
    athleteId: '00000000-0000-4000-8000-00000000c0de',
    defending: 55,
    dribbling: 66,
    incomplete: false,
    overall: 74,
    pace: 88,
    passing: 70,
    photoPath: null,
    physical: 62,
    primaryPosition: 'Atacante',
    shirtName: 'Fulano',
    shirtNumber: 9,
    shooting: 91,
    ...overrides,
  };
}

describe('mapa sigla↔atributo e ordem (FR-019g)', () => {
  it('usa a sigla fixa de cada atributo', () => {
    expect(ATTRIBUTE_SIGLA).toEqual({
      pace: 'RIT',
      shooting: 'FIN',
      passing: 'PAS',
      dribbling: 'CON',
      defending: 'DEF',
      physical: 'FÍS',
    });
  });

  it('ordena as colunas RIT, FIN, PAS, CON, DEF, FÍS', () => {
    expect(ATTRIBUTE_COLUMNS.map((c) => c.sigla)).toEqual(['RIT', 'FIN', 'PAS', 'CON', 'DEF', 'FÍS']);
    expect(ATTRIBUTE_COLUMNS.map((c) => c.key)).toEqual([
      'pace',
      'shooting',
      'passing',
      'dribbling',
      'defending',
      'physical',
    ]);
  });
});

describe('abreviação de posição pt-BR (FR-019c)', () => {
  it('resolve posições do mapa, ignorando caixa e acentos', () => {
    expect(abbreviatePosition('Goleiro')).toBe('GOL');
    expect(abbreviatePosition('zagueiro')).toBe('ZAG');
    expect(abbreviatePosition('Volante')).toBe('VOL');
    expect(abbreviatePosition('Lateral Direito')).toBe('LAD');
    expect(abbreviatePosition('  meia  ')).toBe('MEI');
  });

  it('cai para as 3 primeiras letras maiúsculas quando não mapeada', () => {
    expect(abbreviatePosition('Líbero')).toBe('LIB');
    expect(abbreviatePosition('Quarterback')).toBe('QUA');
  });

  it('devolve travessão quando a posição é vazia', () => {
    expect(abbreviatePosition('')).toBe('—');
    expect(abbreviatePosition(null)).toBe('—');
  });
});

describe('render do cartão', () => {
  it('exibe o overall exatamente como veio da query, sem recalcular', () => {
    render(<AttributeCard card={makeCard({ overall: 74 })} />);
    expect(screen.getByText('74')).toBeInTheDocument();
    // média real dos seis valores seria 76 — não deve aparecer
    expect(screen.queryByText('76')).not.toBeInTheDocument();
  });

  it('mostra as siglas e os seis valores na variante detalhada', () => {
    render(<AttributeCard card={makeCard()} />);
    for (const sigla of ['RIT', 'FIN', 'PAS', 'CON', 'DEF', 'FÍS']) {
      expect(screen.getByText(sigla)).toBeInTheDocument();
    }
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('91')).toBeInTheDocument();
  });

  it('entra em estado incompleto quando algum atributo é nulo', () => {
    const { container } = render(
      <AttributeCard card={makeCard({ overall: null, incomplete: true, pace: null })} />,
    );
    expect(container.querySelector('article')?.dataset.incomplete).toBe('true');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('na variante compacta sem overall, não renderiza o selo', () => {
    const { rerender, container } = render(
      <AttributeCard card={makeCard({ overall: 82 })} variant="compact" />,
    );
    expect(screen.getByText('82')).toBeInTheDocument();

    rerender(<AttributeCard card={makeCard({ overall: null, incomplete: true })} variant="compact" />);
    expect(container.querySelector('article')?.dataset.incomplete).toBe('true');
    expect(screen.queryByText('82')).not.toBeInTheDocument();
  });
});
