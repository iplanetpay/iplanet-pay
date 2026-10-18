/**
 * Contrato de dados da escalada de metas (iPlanet Pay).
 * Tudo que o backend de metas/aportes precisa entregar está aqui.
 */

/** Estado de saúde da meta. Controla escalador, clima e mensagens. */
export type GoalStatus = 'on_track' | 'near_late' | 'late' | 'done';

/** Situação de cada aporte agendado. */
export type DepositStatus =
  | 'paid_on_time' // pago no prazo (check verde no calendário)
  | 'paid_late' // pago fora do prazo (amarelo)
  | 'pending' // ainda vai vencer
  | 'missed'; // venceu e não foi pago (X vermelho)

export interface Deposit {
  id: string;
  /** Data limite do aporte (ISO yyyy-mm-dd). */
  dueDate: string;
  /** Valor combinado, em reais. */
  amount: number;
  status: DepositStatus;
  /** Quando foi efetivamente pago (ISO), se foi. */
  paidAt?: string;
}

export type PrizeKind = 'phone' | 'laptop' | 'headphones' | 'gift';

export interface GoalProduct {
  name: string;
  kind: PrizeKind;
}

export interface GoalState {
  id: string;
  /** Nome dado pelo usuário à meta. */
  name: string;
  product: GoalProduct;
  status: GoalStatus;
  /** Valor total da meta (R$). */
  targetAmount: number;
  /** Quanto já foi guardado (R$). */
  savedAmount: number;
  /** 0–100. Se omitido é calculado por savedAmount/targetAmount. */
  percent?: number;
  deposits: Deposit[];
  /** Quantos dias de atraso (quando status = late). */
  daysLate?: number;
  /** Sequência de aportes em dia. */
  streak?: number;
}

/** Clima já interpretado, independente do provedor (Open-Meteo, OpenWeatherMap...). */
export type WeatherKind =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'blizzard';

export interface RealWeather {
  kind: WeatherKind;
  temperatureC: number;
  windKmh: number;
  /** Hora local do usuário em decimal (ex.: 14.5 = 14:30). */
  localHour: number;
  /** Nascer / pôr do sol em hora decimal local. */
  sunrise: number;
  sunset: number;
  source: string;
  place: string;
}

/** Clima final aplicado na cena depois de considerar a saúde da meta. */
export interface EffectiveWeather {
  kind: WeatherKind;
  /** 0–1 */
  intensity: number;
  /** 0–1 */
  wind: number;
  temperatureC: number;
}

export interface Coords {
  lat: number;
  lon: number;
}

export interface WeatherProvider {
  name: string;
  getCurrent(coords: Coords): Promise<RealWeather>;
}

export type ViewMode = 'overview' | 'closeup';

export type TimeOfDayPreset = 'real' | 'morning' | 'afternoon' | 'dusk' | 'night';

export interface MetasClimbProps {
  goal: GoalState;
  /** Provedor de clima. Padrão: Open-Meteo (sem chave). */
  weatherProvider?: WeatherProvider;
  /** Coordenadas fixas; se omitido usa geolocalização do navegador (fallback São Paulo). */
  coords?: Coords;
  /** Força o clima final (painel de testes). 'real' = usa clima real + regra da meta. */
  weatherOverride?: WeatherKind | 'real';
  /** Força o horário (painel de testes). */
  timeOverride?: TimeOfDayPreset;
  initialView?: ViewMode;
  onViewChange?: (v: ViewMode) => void;
  /** Chamado pelo botão "Fazer aporte". */
  onDeposit?: (goal: GoalState) => void;
  /** Notifica o pai com o clima real carregado (para o painel de testes). */
  onRealWeather?: (w: RealWeather | null) => void;
}
