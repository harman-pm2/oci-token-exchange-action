import crypto from 'crypto';
import { Platform } from './platforms/types';
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
export declare function tokenExchangeJwtToUpst(platform: Platform, { tokenExchangeURL, clientCred, ociPublicKey, subjectToken, retryCount, currentAttempt }: TokenExchangeConfig): Promise<UpstTokenResponse>;
export declare function configureOciCli(platform: Platform, config: OciConfig): Promise<void>;
interface UpstTokenResponse {
    token: string;
}
export declare function main(): Promise<void>;
export { TokenExchangeError, TokenExchangeConfig, OciConfig };
