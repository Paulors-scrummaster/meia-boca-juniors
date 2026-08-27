export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

type DateTimeInput = Date | number | string;

function parseInstant(value: DateTimeInput): Date {
  const instant = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('Data ou hora inválida.');
  }

  return instant;
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: SAO_PAULO_TIME_ZONE,
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  timeZone: SAO_PAULO_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  timeZone: SAO_PAULO_TIME_ZONE,
  year: 'numeric',
});

export function formatSaoPauloDate(value: DateTimeInput): string {
  return dateFormatter.format(parseInstant(value));
}

export function formatSaoPauloTime(value: DateTimeInput): string {
  return timeFormatter.format(parseInstant(value));
}

export function formatSaoPauloDateTime(value: DateTimeInput): string {
  return dateTimeFormatter.format(parseInstant(value));
}

export function toUtcIsoString(value: DateTimeInput): string {
  return parseInstant(value).toISOString();
}
