import { motion } from 'framer-motion';
import type { ViewMode } from '@/lib/goals/climb/types';

/** Controle segmentado (estilo iOS): Visão geral | De perto. */
export function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: Array<{ id: ViewMode; label: string }> = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'closeup', label: 'De perto' },
  ];
  return (
    <div className="segmented glass" role="tablist" aria-label="Alternar visão">
      {opts.map((o) => (
        <button type="button" key={o.id} role="tab" aria-selected={view === o.id} className={view === o.id ? "active" : ""} onClick={() => onChange(o.id)} data-view={o.id}>
          {view === o.id && <motion.span layoutId="seg-thumb" className="seg-thumb" transition={{ type: 'spring', stiffness: 460, damping: 38 }} />}
          <span className="seg-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
