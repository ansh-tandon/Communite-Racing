import { season } from '../lib/season';

// Papel picado: a string of cut-paper flags across the top of the page for Día de Muertos.
const FLAGS = ['#D61F7A', '#F5A524', '#8B4FD8', '#1FB6A6', '#F0489C', '#F5A524'];

function Flag({ x, color }: { x: number; color: string }) {
  return (
    <g transform={`translate(${x} 2)`}>
      <path d="M0 0h34v22l-4 4-4-4-4 4-4-4-4 4-4-4-4 4-4-4-2 2z" fill={color} />
      {/* the cut-outs: a little skull and petals */}
      <circle cx="17" cy="9" r="4.2" fill="#0B0D10" />
      <circle cx="15.4" cy="8.6" r="1" fill={color} />
      <circle cx="18.6" cy="8.6" r="1" fill={color} />
      <path d="M15.5 13.2h3v2.2h-3z" fill="#0B0D10" />
      <circle cx="6" cy="6" r="1.6" fill="#0B0D10" /><circle cx="28" cy="6" r="1.6" fill="#0B0D10" />
      <circle cx="6" cy="16" r="1.2" fill="#0B0D10" /><circle cx="28" cy="16" r="1.2" fill="#0B0D10" />
    </g>
  );
}

export function PapelPicado() {
  if (season !== 'muertos') return null;
  return (
    <div aria-hidden className="pointer-events-none h-7 overflow-hidden border-b border-line/60">
      <svg className="h-7 w-full" preserveAspectRatio="xMinYMin slice" viewBox="0 0 1600 30">
        <path d="M0 2.5H1600" stroke="#F5A524" strokeOpacity=".5" />
        {Array.from({ length: 40 }, (_, i) => <Flag key={i} x={i * 40 + 3} color={FLAGS[i % FLAGS.length]} />)}
      </svg>
    </div>
  );
}

/** A line under a race's title for the Mexico City GP during Día de Muertos. */
export function MuertosNote({ country }: { country: string }) {
  if (season !== 'muertos' || country !== 'Mexico') return null;
  return (
    <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-marigold/40 bg-marigold/10 px-3 py-1 text-sm font-semibold text-marigold">
      <span aria-hidden>💀</span>Día de los Muertos weekend<span aria-hidden>🌼</span>
    </p>
  );
}
