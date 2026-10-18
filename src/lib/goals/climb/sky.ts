import { clamp } from "./goal-logic.ts";
import { OVERCAST } from "./weather.ts";
import type { TimeOfDayPreset, WeatherKind } from "./types.ts";

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export interface SkyState {
  top: string;
  bottom: string;
  /** 0 noite → 1 dia */
  light: number;
  isNight: boolean;
  starsOpacity: number;
  sunOpacity: number;
  moonOpacity: number;
  /** posição % do astro no céu */
  bodyX: number;
  bodyY: number;
  /** cor da montanha (preenchimento claro, contorno sempre preto) */
  mountainFill: string;
  overcast: number;
}

/** Calcula céu, astros e cor de preenchimento da montanha para uma hora local. */
export function computeSky(hour: number, sunrise: number, sunset: number, kind: WeatherKind): SkyState {
  const L = smooth(sunrise - 0.6, sunrise + 0.6, hour) * (1 - smooth(sunset - 0.6, sunset + 0.6, hour));
  const bump = (s: number) => Math.exp(-(((hour - s) / 0.9) ** 2));
  const W = Math.max(bump(sunrise), bump(sunset));
  const oc = OVERCAST[kind];

  // paleta suave e restrita
  let top = mix(hex('#10162e'), hex('#bcd9fb'), L);
  let bottom = mix(hex('#222c52'), hex('#f4f9ff'), L);
  top = mix(top, hex('#b8c4ee'), W * 0.5);
  bottom = mix(bottom, hex('#ffe0cc'), W * 0.75);

  const stormy = kind === 'storm';
  const snowy = kind === 'blizzard' || kind === 'snow';
  const grayTop = mix(hex('#181d30'), stormy ? hex('#7d8594') : snowy ? hex('#b9c1cd') : hex('#b4bcc8'), L);
  const grayBot = mix(hex('#262d46'), stormy ? hex('#b5bbc6') : snowy ? hex('#e3e7ee') : hex('#e0e4ea'), L);
  top = mix(top, grayTop, oc);
  bottom = mix(bottom, grayBot, oc);

  const isDay = hour >= sunrise && hour <= sunset;
  let u = 0;
  if (isDay) u = (hour - sunrise) / (sunset - sunrise);
  else {
    const nightLen = 24 - (sunset - sunrise);
    const since = hour >= sunset ? hour - sunset : hour + 24 - sunset;
    u = since / nightLen;
  }
  u = clamp(u, 0, 1);
  const bodyX = 12 + 76 * u;
  const bodyY = 62 - 46 * Math.sin(Math.PI * u);

  const fillDay = hex('#ffffff');
  const fillNight = hex('#e6eaf4');
  let fill = mix(fillNight, fillDay, L);
  fill = mix(fill, hex(stormy ? '#cdd2db' : '#e3e7ee'), oc * 0.7);

  return {
    top: css(top),
    bottom: css(bottom),
    light: L,
    isNight: L < 0.35,
    starsOpacity: clamp((1 - L) ** 1.5 * (1 - oc * 1.15), 0, 1),
    sunOpacity: clamp(L * (1 - oc * 1.25), 0, 1),
    moonOpacity: clamp((1 - L) * (1 - oc * 1.1), 0, 1),
    bodyX,
    bodyY,
    mountainFill: css(fill),
    overcast: oc,
  };
}

/** Converte o preset de horário em hora decimal. */
export function presetHour(preset: TimeOfDayPreset, real: number, sunset: number): number {
  switch (preset) {
    case "morning":
      return 9;
    case "afternoon":
      return 14.5;
    case "dusk":
      return sunset - 0.2;
    case "night":
      return 22;
    case "real":
      return real;
    default: {
      const exhaustive: never = preset;
      throw new Error(`Horário inválido: ${String(exhaustive)}`);
    }
  }
}
