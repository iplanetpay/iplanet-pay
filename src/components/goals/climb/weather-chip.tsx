import type { WeatherKind } from '@/lib/goals/climb/types';
import { WEATHER_LABEL } from '@/lib/goals/climb/weather';

export function WeatherIcon({ kind, night }: { kind: WeatherKind; night: boolean }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const cloud = <path d="M7 17h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 10.5 3.3 3.3 0 0 0 7 17z" {...p} />;
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      {kind === 'clear' &&
        (night ? (
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" {...p} />
        ) : (
          <g {...p}>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
          </g>
        ))}
      {kind === 'partly_cloudy' && (
        <g>
          <g {...p}>
            <circle cx="9" cy="8" r="3" />
            <path d="M9 2.5v1.3M3.5 8h1.3M5 4l1 1M13 4l-1 1" />
          </g>
          <path d="M9 19h9a3.6 3.6 0 0 0 .5-7.2A5 5 0 0 0 9.2 12.6 3.2 3.2 0 0 0 9 19z" {...p} />
        </g>
      )}
      {(kind === 'cloudy' || kind === 'fog') && (
        <g>
          {cloud}
          {kind === 'fog' && <path d="M4 20h16" {...p} />}
        </g>
      )}
      {kind === 'rain' && (
        <g>
          {cloud}
          <path d="M9 19l-1 2.5M13 19l-1 2.5M17 19l-1 2.5" {...p} />
        </g>
      )}
      {kind === 'storm' && (
        <g>
          {cloud}
          <path d="M12.5 15l-2.5 4h3l-2 3.5" {...p} />
        </g>
      )}
      {(kind === 'snow' || kind === 'blizzard') && (
        <g>
          {cloud}
          <path d="M9 19.5v.1M13 20.5v.1M17 19.5v.1M11 22v.1" {...p} strokeWidth="2.6" />
        </g>
      )}
    </svg>
  );
}

export function WeatherChip({
  kind,
  temp,
  night,
  worsened,
}: {
  kind: WeatherKind;
  temp: number;
  night: boolean;
  worsened: boolean;
}) {
  const label = kind === 'clear' && night ? 'Noite limpa' : WEATHER_LABEL[kind];
  return (
    <div className="pill glass" title={worsened ? 'Clima piorado pela meta atrasada' : 'Clima agradável: meta em dia'}>
      <WeatherIcon kind={kind} night={night} />
      <span>
        {label} · {Math.round(temp)}°C
      </span>
    </div>
  );
}
