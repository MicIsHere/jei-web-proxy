export type LineWidthUnit = 'per_minute' | 'per_second' | 'per_hour' | 'belts';
export type AxisScale = 'linear' | 'log';

export type CurvePoint = {
  x: number;
  y: number;
};

export type LineWidthCurveConfig = {
  unit: LineWidthUnit;
  xScale: AxisScale;
  yScale: AxisScale;
  minWidthPx: number;
  maxWidthPx: number;
  maxInput: number;
  points: CurvePoint[];
};

const DEFAULT_CONTROL_X = [0, 0.15, 0.35, 0.65, 1] as const;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function createDefaultLineWidthCurveConfig(): LineWidthCurveConfig {
  const minWidthPx = 2;
  const maxWidthPx = 20;
  const maxInput = 500;
  const points = DEFAULT_CONTROL_X.map((nx) => {
    const eased = Math.pow(nx, 0.75);
    return {
      x: nx * maxInput,
      y: minWidthPx + eased * (maxWidthPx - minWidthPx),
    };
  });
  return {
    unit: 'per_minute',
    xScale: 'log',
    yScale: 'linear',
    minWidthPx,
    maxWidthPx,
    maxInput,
    points,
  };
}

export function normalizeAxis(value: number, min: number, max: number, scale: AxisScale): number {
  if (!Number.isFinite(value) || max <= min) return 0;
  const v = clamp(value, min, max);
  if (scale === 'linear') {
    return (v - min) / (max - min);
  }
  const span = max - min;
  if (span <= 0) return 0;
  return Math.log1p(v - min) / Math.log1p(span);
}

export function denormalizeAxis(norm: number, min: number, max: number, scale: AxisScale): number {
  if (!Number.isFinite(norm) || max <= min) return min;
  const n = clamp(norm, 0, 1);
  if (scale === 'linear') {
    return min + n * (max - min);
  }
  const span = max - min;
  if (span <= 0) return min;
  return min + Math.expm1(n * Math.log1p(span));
}

export function sanitizeLineWidthCurveConfig(input: LineWidthCurveConfig): LineWidthCurveConfig {
  const minWidthPx = isFiniteNumber(input.minWidthPx) ? clamp(input.minWidthPx, 0.5, 200) : 2;
  const maxWidthPxRaw = isFiniteNumber(input.maxWidthPx) ? clamp(input.maxWidthPx, 1, 300) : 20;
  const maxWidthPx = Math.max(minWidthPx + 0.1, maxWidthPxRaw);
  const maxInput = isFiniteNumber(input.maxInput) ? clamp(input.maxInput, 0.0001, 1_000_000) : 500;
  const unit: LineWidthUnit =
    input.unit === 'per_second' ||
    input.unit === 'per_hour' ||
    input.unit === 'belts' ||
    input.unit === 'per_minute'
      ? input.unit
      : 'per_minute';
  const xScale: AxisScale = input.xScale === 'linear' || input.xScale === 'log' ? input.xScale : 'log';
  const yScale: AxisScale = input.yScale === 'linear' || input.yScale === 'log' ? input.yScale : 'linear';

  const rawPoints = Array.isArray(input.points) ? input.points : [];
  const mapped = rawPoints
    .filter((p) => p && isFiniteNumber(p.x) && isFiniteNumber(p.y))
    .map((p) => ({
      x: clamp(p.x, 0, maxInput),
      y: clamp(p.y, minWidthPx, maxWidthPx),
    }))
    .sort((a, b) => a.x - b.x);

  const points =
    mapped.length >= 2
      ? mapped
      : [
          { x: 0, y: minWidthPx },
          { x: maxInput, y: maxWidthPx },
        ];

  points[0]!.x = 0;
  points[points.length - 1]!.x = maxInput;
  const minGap = Math.max(maxInput * 0.002, 1e-6);
  for (let i = 1; i < points.length - 1; i += 1) {
    const left = (points[i - 1]?.x ?? 0) + minGap;
    const right = (points[i + 1]?.x ?? maxInput) - minGap;
    points[i]!.x = clamp(points[i]!.x, left, Math.max(left, right));
  }
  points.forEach((p) => {
    p.y = clamp(p.y, minWidthPx, maxWidthPx);
  });

  return {
    unit,
    xScale,
    yScale,
    minWidthPx,
    maxWidthPx,
    maxInput,
    points,
  };
}

export function convertAmountPerMinuteToUnitValue(
  amountPerMinute: number,
  beltSpeedItemsPerSecond: number,
  unit: LineWidthUnit,
): number {
  const amount = Math.max(0, Number.isFinite(amountPerMinute) ? amountPerMinute : 0);
  if (unit === 'per_second') return amount / 60;
  if (unit === 'per_hour') return amount * 60;
  if (unit === 'belts') return amount / 60 / Math.max(1e-9, beltSpeedItemsPerSecond);
  return amount;
}

export function evaluateLineWidthCurve(inputValue: number, configRaw: LineWidthCurveConfig): number {
  const config = sanitizeLineWidthCurveConfig(configRaw);
  const x = clamp(
    Number.isFinite(inputValue) ? inputValue : 0,
    0,
    config.maxInput,
  );
  const points = config.points;
  if (!points.length) return config.minWidthPx;
  if (x <= points[0]!.x) return points[0]!.y;
  if (x >= points[points.length - 1]!.x) return points[points.length - 1]!.y;

  let left = points[0]!;
  let right = points[points.length - 1]!;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (x >= a.x && x <= b.x) {
      left = a;
      right = b;
      break;
    }
  }

  const tx = normalizeAxis(x, 0, config.maxInput, config.xScale);
  const tx0 = normalizeAxis(left.x, 0, config.maxInput, config.xScale);
  const tx1 = normalizeAxis(right.x, 0, config.maxInput, config.xScale);
  const t = tx1 > tx0 ? clamp((tx - tx0) / (tx1 - tx0), 0, 1) : 0;

  const ty0 = normalizeAxis(left.y, config.minWidthPx, config.maxWidthPx, config.yScale);
  const ty1 = normalizeAxis(right.y, config.minWidthPx, config.maxWidthPx, config.yScale);
  const ty = ty0 + (ty1 - ty0) * t;

  return denormalizeAxis(ty, config.minWidthPx, config.maxWidthPx, config.yScale);
}
