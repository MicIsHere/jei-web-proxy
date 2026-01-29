export class PackValidationError extends Error {
  readonly jsonPath: string;

  constructor(jsonPath: string, message: string) {
    super(`${jsonPath}: ${message}`);
    this.name = 'PackValidationError';
    this.jsonPath = jsonPath;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertRecord(value: unknown, jsonPath: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new PackValidationError(jsonPath, 'expected object');
  }
  return value;
}

export function assertString(value: unknown, jsonPath: string): string {
  if (typeof value !== 'string') {
    throw new PackValidationError(jsonPath, 'expected string');
  }
  return value;
}

export function assertNumber(value: unknown, jsonPath: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new PackValidationError(jsonPath, 'expected number');
  }
  return value;
}

export function assertArray(value: unknown, jsonPath: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new PackValidationError(jsonPath, 'expected array');
  }
  return value;
}

export function assertOptionalString(value: unknown, jsonPath: string): string | undefined {
  if (value === undefined) return undefined;
  return assertString(value, jsonPath);
}

export function assertOptionalNumber(value: unknown, jsonPath: string): number | undefined {
  if (value === undefined) return undefined;
  return assertNumber(value, jsonPath);
}

export function assertOptionalArray(value: unknown, jsonPath: string): unknown[] | undefined {
  if (value === undefined) return undefined;
  return assertArray(value, jsonPath);
}

export function assertOptionalRecord(value: unknown, jsonPath: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  return assertRecord(value, jsonPath);
}
