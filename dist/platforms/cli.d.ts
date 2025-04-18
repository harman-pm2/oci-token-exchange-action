import { Platform, PlatformLogger, PlatformConfig } from './types';
export declare class CLIPlatform implements Platform {
    private config;
    private readonly _logger;
    constructor(config: PlatformConfig);
    getInput(name: string, required?: boolean): string;
    setOutput(name: string, value: string): void;
    setFailed(message: string): void;
    isDebug(): boolean;
    getOIDCToken(audience: string): Promise<string>;
    get logger(): PlatformLogger;
}
