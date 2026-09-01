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

const saoPauloInputFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  timeZone: SAO_PAULO_TIME_ZONE,
  year: 'numeric',
});

function formattedParts(value: Date): Record<string, string> {
  return Object.fromEntries(
    saoPauloInputFormatter
      .formatToParts(value)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value: partValue }) => [type, partValue]),
  );
}

export function toSaoPauloLocalInput(value: DateTimeInput): string {
  const parts = formattedParts(parseInstant(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function saoPauloLocalToUtcIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new RangeError('Data ou hora inválida.');
  const [, year, month, day, hour, minute] = match;
  const target = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  let instant = target;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formattedParts(new Date(instant));
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    instant += target - represented;
  }

  const resolved = new Date(instant);
  if (toSaoPauloLocalInput(resolved) !== value) throw new RangeError('Data ou hora inválida.');
  return resolved.toISOString();
}
