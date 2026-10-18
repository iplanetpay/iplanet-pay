import type {
  Coords,
  EffectiveWeather,
  GoalStatus,
  RealWeather,
  WeatherKind,
  WeatherProvider,
} from "./types.ts";

/** Fallback: São Paulo. */
export const SAO_PAULO: Coords = { lat: -23.5505, lon: -46.6333 };

/** Clima de reserva usado quando a API/rede falha — sempre há algo para renderizar. */
export function fallbackWeather(note = 'offline'): RealWeather {
  const d = new Date();
  return {
    kind: 'partly_cloudy',
    temperatureC: 22,
    windKmh: 12,
    localHour: d.getHours() + d.getMinutes() / 60,
    sunrise: 5.9,
    sunset: 17.9,
    source: `simulado (${note})`,
    place: 'São Paulo',
  };
}

const hhmm = (iso: string | undefined, fb: number) => {
  if (!iso) return fb;
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? Number(m[1]) + Number(m[2]) / 60 : fb;
};

/** WMO weather code (Open-Meteo) → WeatherKind */
export function wmoToKind(code: number): WeatherKind {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly_cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code === 85) return 'snow';
  if (code === 86) return 'blizzard';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

/** Provedor padrão: Open-Meteo (gratuito, sem chave). */
export const openMeteoProvider: WeatherProvider = {
  name: 'Open-Meteo',
  async getCurrent({ lat, lon }) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,is_day&daily=sunrise,sunset&forecast_days=1&timezone=auto`;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 6000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error('open-meteo ' + r.status);
      const j = await r.json();
      const c = j.current;
      return {
        kind: wmoToKind(c.weather_code),
        temperatureC: c.temperature_2m,
        windKmh: c.wind_speed_10m,
        localHour: hhmm(c.time, new Date().getHours()),
        sunrise: hhmm(j.daily?.sunrise?.[0], 6),
        sunset: hhmm(j.daily?.sunset?.[0], 18),
        source: 'Open-Meteo',
        place: `${lat.toFixed(1)}, ${lon.toFixed(1)}`,
      };
    } finally {
      clearTimeout(to);
    }
  },
};

/**
 * Exemplo de troca de provedor: OpenWeatherMap (precisa de chave).
 * Uso: <MetasClimb weatherProvider={createOpenWeatherMapProvider(KEY)} />
 */
export function createOpenWeatherMapProvider(apiKey: string): WeatherProvider {
  const owmToKind = (id: number): WeatherKind => {
    if (id >= 200 && id < 300) return 'storm';
    if (id >= 300 && id < 600) return 'rain';
    if (id >= 600 && id < 700) return id >= 620 ? 'blizzard' : 'snow';
    if (id >= 700 && id < 800) return 'fog';
    if (id === 800) return 'clear';
    if (id <= 802) return 'partly_cloudy';
    return 'cloudy';
  };
  return {
    name: 'OpenWeatherMap',
    async getCurrent({ lat, lon }) {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=pt_br&appid=${apiKey}`,
      );
      if (!r.ok) throw new Error('owm ' + r.status);
      const j = await r.json();
      const off = j.timezone ?? 0; // segundos
      const toH = (unix: number) => {
        const d = new Date((unix + off) * 1000);
        return d.getUTCHours() + d.getUTCMinutes() / 60;
      };
      return {
        kind: owmToKind(j.weather?.[0]?.id ?? 800),
        temperatureC: j.main.temp,
        windKmh: (j.wind?.speed ?? 0) * 3.6,
        localHour: toH(Date.now() / 1000),
        sunrise: toH(j.sys.sunrise),
        sunset: toH(j.sys.sunset),
        source: 'OpenWeatherMap',
        place: j.name ?? `${lat.toFixed(1)}, ${lon.toFixed(1)}`,
      };
    },
  };
}

/** Geolocalização com timeout curto e fallback para São Paulo. */
export function getCoords(): Promise<Coords> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(SAO_PAULO);
    const t = setTimeout(() => resolve(SAO_PAULO), 3500);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(t);
        resolve({ lat: p.coords.latitude, lon: p.coords.longitude });
      },
      () => {
        clearTimeout(t);
        resolve(SAO_PAULO);
      },
      { timeout: 3000, maximumAge: 600000 },
    );
  });
}

/**
 * Regra de negócio do clima:
 *  - em dia / concluída → clima agradável (sol ou poucas nuvens)
 *  - quase atrasada     → piora um degrau
 *  - atrasada           → temporal, chuva forte, nevasca e vento
 */
export function effectiveWeather(real: RealWeather, status: GoalStatus): EffectiveWeather {
  const base = real.kind;
  const t = real.temperatureC;
  const realWind = Math.min(1, real.windKmh / 60);
  switch (status) {
    case 'on_track':
    case 'done': {
      const kind: WeatherKind = base === 'clear' ? 'clear' : 'partly_cloudy';
      return { kind: status === 'done' ? 'clear' : kind, intensity: 0, wind: Math.min(0.25, realWind), temperatureC: t };
    }
    case 'near_late': {
      const step: Record<WeatherKind, [WeatherKind, number]> = {
        clear: ['partly_cloudy', 0],
        partly_cloudy: ['cloudy', 0],
        cloudy: ['rain', 0.35],
        fog: ['rain', 0.35],
        rain: ['rain', 0.75],
        storm: ['storm', 0.7],
        snow: ['snow', 0.7],
        blizzard: ['blizzard', 0.7],
      };
      const [kind, intensity] = step[base];
      return { kind, intensity, wind: Math.max(0.45, realWind), temperatureC: t };
    }
    case 'late': {
      // chuva vira nevasca; neve vira nevasca; o resto vira tempestade
      const kind: WeatherKind =
        base === 'rain' || base === 'snow' || base === 'blizzard' || t <= 1 ? 'blizzard' : 'storm';
      return { kind, intensity: 1, wind: Math.max(0.9, realWind), temperatureC: Math.min(t, 6) };
    }
    default: {
      const exhaustive: never = status;
      throw new Error(`Status inválido: ${String(exhaustive)}`);
    }
  }
}

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  clear: 'Ensolarado',
  partly_cloudy: 'Parcialmente nublado',
  cloudy: 'Nublado',
  fog: 'Neblina',
  rain: 'Chuva',
  storm: 'Tempestade',
  snow: 'Neve',
  blizzard: 'Nevasca',
};

/** Quão encoberto o céu está (0–1) — usado por SkyCycle/Clouds. */
export const OVERCAST: Record<WeatherKind, number> = {
  clear: 0,
  partly_cloudy: 0.18,
  cloudy: 0.55,
  fog: 0.5,
  rain: 0.72,
  storm: 0.92,
  snow: 0.62,
  blizzard: 0.82,
};
