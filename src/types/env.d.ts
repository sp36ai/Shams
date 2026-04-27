/**
 * Ambient declarations for Metro / React Native global environment.
 * process.env is shimmed by Metro bundler — these types make TS aware of it.
 */

declare const process: {
  readonly env: {
    readonly NODE_ENV: 'development' | 'production' | 'test' | undefined;
    readonly [key: string]: string | undefined;
  };
};
