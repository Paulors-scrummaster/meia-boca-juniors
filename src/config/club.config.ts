export const APPROVED_FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2'] as const;

export type ApprovedFormation = (typeof APPROVED_FORMATIONS)[number];

export const SEMANTIC_THEME_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
] as const;

export type SemanticThemeToken = (typeof SEMANTIC_THEME_TOKENS)[number];

interface ClubConfig {
  identity: {
    deploymentId: 'mbj';
    fullName: string;
    shortName: string;
    initials: string;
    slogan: string;
  };
  institutional: {
    welcomeTitle: string;
    welcomeDescription: string;
  };
  links: {
    canonicalWebsite: string;
    support: string | null;
    privacy: string | null;
  };
  assets: {
    logo: string;
    favicon: string;
    pwaIcon192: string;
  };
  theme: Readonly<Record<SemanticThemeToken, string>>;
  approvedFormations: readonly ApprovedFormation[];
}

export const clubConfig = {
  identity: {
    deploymentId: 'mbj',
    fullName: 'Meia Boca Juniors',
    shortName: 'MBJ',
    initials: 'MBJ',
    slogan: 'Raça, amizade e futebol.',
  },
  institutional: {
    welcomeTitle: 'Bem-vindo ao Meia Boca Juniors',
    welcomeDescription:
      'O ponto de encontro do clube para organizar elenco, partidas, presenças e nossa história.',
  },
  links: {
    canonicalWebsite: 'https://meiabocajuniors.dbidigital.com.br',
    support: null,
    privacy: null,
  },
  assets: {
    logo: '/brand/logo.svg',
    favicon: '/favicon.svg',
    pwaIcon192: '/pwa-192x192.png',
  },
  theme: {
    background: '220 35% 98%',
    foreground: '216 65% 12%',
    card: '0 0% 100%',
    'card-foreground': '216 65% 12%',
    primary: '217 74% 24%',
    'primary-foreground': '43 78% 92%',
    secondary: '43 82% 55%',
    'secondary-foreground': '216 65% 12%',
    muted: '216 24% 92%',
    'muted-foreground': '216 15% 38%',
    accent: '43 82% 55%',
    'accent-foreground': '216 65% 12%',
    destructive: '0 72% 51%',
    'destructive-foreground': '0 0% 100%',
    border: '216 24% 82%',
    input: '216 24% 82%',
    ring: '43 82% 55%',
  },
  approvedFormations: APPROVED_FORMATIONS,
} as const satisfies ClubConfig;
