import { Square, LayoutGrid, Grid3x3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GridDensity = 1 | 2 | 3;

interface GridDensitySelectorProps {
  value: GridDensity;
  onChange: (value: GridDensity) => void;
  className?: string;
}

const options: { value: GridDensity; icon: typeof Square; label: string }[] = [
  { value: 1, icon: Square, label: '1 coluna' },
  { value: 2, icon: LayoutGrid, label: '2 colunas' },
  { value: 3, icon: Grid3x3, label: '3 colunas' },
];

export function GridDensitySelector({ value, onChange, className }: GridDensitySelectorProps) {
  return (
    <div
      className={cn(
        'hidden md:inline-flex items-center rounded-md border bg-background p-0.5 shadow-sm',
        className
      )}
      role="group"
      aria-label="Densidade do grid"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex h-7 w-8 items-center justify-center rounded-sm transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={active}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
