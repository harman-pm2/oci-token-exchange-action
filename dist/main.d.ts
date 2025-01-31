import crypto from 'crypto';
interface TokenExchangeConfig {
    tokenExchangeURL: string;
    clientCred: string;
    ociPublicKey: string;
    subjectToken: string;
    retryCount: number;
    currentAttempt?: number;
}
interface OciConfig {
    privateKey: crypto.KeyObject;
    publicKey: crypto.KeyObject;
    upstToken: string;
    ociFingerprint: string;
    ociTenancy: string;
    ociRegion: string;
}
declare class TokenExchangeError extends Error {
    readonly cause?: unknown | undefined;
    constructor(message: string, cause?: unknown | undefined);
}
export declare function configureOciCli(config: OciConfig): Promise<void>;
export declare function main(): Promise<void>;
export { TokenExchangeError, TokenExchangeConfig, OciConfig };
