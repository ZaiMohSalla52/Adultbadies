declare module 'vitest' {
  interface ExpectMatchers {
    toBe(expected: unknown): void;
    toContain(expected: unknown): void;
    toThrow(expected?: unknown): void;
    toBeTruthy(): void;
    not: {
      toBe(expected: unknown): void;
    };
  }

  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void): void;
  export function expect(actual: unknown): ExpectMatchers;
}

declare module 'vitest/config' {
  export function defineConfig(config: Record<string, unknown>): Record<string, unknown>;
}
