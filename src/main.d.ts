/**
 * Copyright (c) 2021, 2024 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import * as crypto from 'crypto';
import { Platform } from './platforms/types';

/**
 * Configuration for the OCI CLI setup
 */
export interface OciConfig {
  /**
   * Private key used for OCI authentication
   */
  privateKey: crypto.KeyObject;
  
  /**
   * Public key used for OCI authentication
   */
  publicKey: crypto.KeyObject;
  
  /**
   * User principal security token obtained from token exchange
   */
  upstToken: string;
  
  /**
   * Fingerprint of the public key
   */
  ociFingerprint: string;
  
  /**
   * OCI tenancy OCID
   */
  ociTenancy: string;
  
  /**
   * OCI region identifier
   */
  ociRegion: string;
}

/**
 * Configuration for token exchange operation
 */
export interface TokenExchangeConfig {
  /**
   * URL of the token exchange endpoint
   */
  tokenExchangeURL: string;
  
  /**
   * Base64-encoded client credentials
   */
  clientCred: string;
  
  /**
   * Base64-encoded DER format of the OCI public key
   */
  ociPublicKey: string;
  
  /**
   * JWT token to be exchanged
   */
  subjectToken: string;
  
  /**
   * Number of retry attempts for token exchange
   */
  retryCount: number;
  
  /**
   * Current attempt number (used internally for retries)
   */
  currentAttempt?: number;
}

/**
 * Response from token exchange operation
 */
export interface UpstTokenResponse {
  /**
   * The exchanged UPST token
   */
  token: string;
}

/**
 * Custom error class for token exchange errors
 */
export class TokenExchangeError extends Error {
  /**
   * Creates a new TokenExchangeError
   * @param message Error message
   * @param cause Underlying cause of the error
   */
  constructor(message: string, cause?: unknown);
  
  /**
   * The underlying cause of the error
   */
  readonly cause?: unknown;
}

/**
 * Exchanges a JWT token for an OCI UPST token
 * @param platform Platform instance for logging and configuration
 * @param config Token exchange configuration
 * @returns Promise resolving to UPST token response
 */
export function tokenExchangeJwtToUpst(
  platform: Platform,
  config: TokenExchangeConfig
): Promise<UpstTokenResponse>;

/**
 * Configures the OCI CLI with the provided configuration
 * @param platform Platform instance for logging and configuration
 * @param config OCI configuration
 * @returns Promise resolving when configuration is complete
 */
export function configureOciCli(
  platform: Platform,
  config: OciConfig
): Promise<void>;

/**
 * Main entry point for the action
 * @returns Promise resolving when the action completes
 */
export function main(): Promise<void>;
