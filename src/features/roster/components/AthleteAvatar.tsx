import { useState } from 'react';

import { athleteInitials } from '@/features/roster/lib/athlete-initials';

interface AthleteAvatarProps {
  className?: string;
  name: string;
  url?: string | null;
}

export function AthleteAvatar({ className = '', name, url }: AthleteAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl === url;

  // Superfície navy, não bg-primary: com o anel dourado (ring-secondary), um fundo
  // também dourado faz o anel desaparecer contra o próprio fundo. A composição —
  // campo navy com contorno dourado — espelha o escudo oficial.
  const classes = `grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-elevated font-black text-primary ring-2 ring-secondary ${className}`;
  if (url && !failed) {
    return (
      <img
        alt={`Foto de ${name}`}
        className={`${classes} object-cover`}
        onError={() => setFailedUrl(url)}
        src={url}
      />
    );
  }
  return (
    <span aria-label={`Avatar de ${name}`} className={classes} role="img">
      {athleteInitials(name)}
    </span>
  );
}
