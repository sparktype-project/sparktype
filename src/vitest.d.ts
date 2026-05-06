/// <reference types="vitest/globals" />

declare global {
  type Mock<T extends (...args: any[]) => any = (...args: any[]) => any> = import('vitest').Mock<T>;
  type Mocked<T> = import('vitest').Mocked<T>;
  type MockedFunction<T extends (...args: any[]) => any> = import('vitest').MockedFunction<T>;
  type SpyInstance<T extends (...args: any[]) => any = (...args: any[]) => any> = import('vitest').MockInstance<T>;
}

export {};
