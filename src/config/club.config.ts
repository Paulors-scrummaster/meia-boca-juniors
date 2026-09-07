export const APPROVED_FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2'] as const;

export type ApprovedFormation = (typeof APPROVED_FORMATIONS)[number];

export const SEMANTIC_THEME_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'elevated',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'border',
  'input',
  'ring',
  'overlay',
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'destructive',
  'destructive-foreground',
  'info',
  'info-foreground',
  'pitch',
  'pitch-foreground',
  'pitch-line',
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
    background: '220 58% 9%',
    foreground: '0 0% 100%',
    card: '222 51% 14%',
    'card-foreground': '0 0% 100%',
    elevated: '221 45% 18%',
    primary: '45 84% 49%',
    'primary-foreground': '220 58% 9%',
    secondary: '47 90% 55%',
    'secondary-foreground': '220 58% 9%',
    muted: '223 46% 16%',
    'muted-foreground': '215 20% 65%',
    accent: '45 84% 49%',
    'accent-foreground': '220 58% 9%',
    border: '220 43% 24%',
    input: '220 38% 48%',
    ring: '45 84% 49%',
    overlay: '0 0% 0%',
    success: '158 64% 52%',
    'success-foreground': '220 58% 9%',
    warning: '27 96% 61%',
    'warning-foreground': '220 58% 9%',
    destructive: '0 91% 71%',
    'destructive-foreground': '220 58% 9%',
    info: '213 94% 68%',
    'info-foreground': '220 58% 9%',
    pitch: '160 61% 15%',
    'pitch-foreground': '0 0% 100%',
    'pitch-line': '159 11% 75%',
  },
  approvedFormations: APPROVED_FORMATIONS,
} as const satisfies ClubConfig;
