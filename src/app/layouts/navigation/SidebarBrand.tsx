import { clubConfig } from '@/config/club.config';

/**
 * Identidade do clube (C-L1/FR-015: topo fixo da barra lateral). Reaproveitada pela
 * gaveta mobile (FR-022) para replicar a mesma hierarquia vertical.
 */
export function SidebarBrand() {
  return (
    <div className="flex items-center gap-3">
      <img
        alt={`Escudo do ${clubConfig.identity.shortName}`}
        className="h-11 w-11"
        src={clubConfig.assets.crest}
      />
      <div>
        <p className="font-black">{clubConfig.identity.shortName}</p>
        <p className="text-xs text-muted-foreground">Área do clube</p>
      </div>
    </div>
  );
}
