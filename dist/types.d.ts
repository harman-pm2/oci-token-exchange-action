import crypto from 'crypto';
/**
 * Configuration for token exchange operations
 */
export interface TokenExchangeConfig {
    tokenExchangeURL: string;
    clientCred: string;
    ociPublicKey: string;
    /** JWT token obtained from the CI platform's OIDC provider */
    subjectToken: string;
    retryCount: number;
    currentAttempt?: number;
}
/**
 * Configuration for the OCI CLI
 */
export interface OciConfig {
    privateKey: crypto.KeyObject;
    publicKey: crypto.KeyObject;
    upstToken: string;
    ociFingerprint: string;
    ociTenancy: string;
    ociRegion: string;
}
/**
 * Input configuration for the CLI/Action
 */
export interface ConfigInputs {
    oidc_client_identifier: string;
    domain_base_url: string;
    oci_tenancy: string;
    oci_region: string;
}
/**
 * Response from the token exchange service
 */
export interface UpstTokenResponse {
    token: string;
}
/**
 * Custom error class for token exchange failures
 */
export declare class TokenExchangeError extends Error {
    readonly cause?: unknown | undefined;
    constructor(message: string, cause?: unknown | undefined);
}
