export interface PlatformLogger {
  debug(message: string): void;
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

export interface Platform {
  getInput(name: string, required?: boolean): string;
  setOutput(name: string, value: string): void;
  setFailed(message: string): void;
  isDebug(): boolean;
  logger: PlatformLogger;
  getOIDCToken(audience: string): Promise<string>;
}

export interface PlatformConfig {
  tokenEnvVar?: string;
  audience: string;
}
