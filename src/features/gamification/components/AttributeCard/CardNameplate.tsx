// Feature 003 · US4 · T089a — nameplate (FR-019f).
// Nome grande e centralizado na região inferior, tipografia esportiva de display
// (`font-display` → Rajdhani), entre filetes dourados finos.

interface CardNameplateProps {
  name: string;
  className?: string;
}

export function CardNameplate({ className = '', name }: CardNameplateProps) {
  return (
    <div className={`flex flex-col items-center gap-[0.4cqw] text-secondary ${className}`}>
      <span className="h-px w-3/4 bg-secondary/70" />
      <span className="font-display text-[9cqw] font-bold uppercase leading-none tracking-wide">
        {name}
      </span>
      <span className="h-px w-3/4 bg-secondary/70" />
    </div>
  );
}
