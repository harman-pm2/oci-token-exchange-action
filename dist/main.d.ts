import { Platform } from './platforms/types';
import { TokenExchangeConfig, OciConfig, UpstTokenResponse, TokenExchangeError } from './types';
/**
 * Performs a basic structural validation of a JWT and logs debug information.
 * @param platform The platform instance for logging.
 * @param token The JWT token string.
 */
export declare function tokenExchangeJwtToUpst(platform: Platform, { tokenExchangeURL, clientCred, ociPublicKey, subjectToken, retryCount, currentAttempt }: TokenExchangeConfig): Promise<UpstTokenResponse>;
export declare function configureOciCli(platform: Platform, config: OciConfig): Promise<void>;
export declare function main(): Promise<void>;
export { TokenExchangeError, TokenExchangeConfig, OciConfig };
