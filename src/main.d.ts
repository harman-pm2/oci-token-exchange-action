/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import { Platform } from './platforms/types';
import { 
  OciConfig, 
  TokenExchangeConfig, 
  UpstTokenResponse, 
  TokenExchangeError 
} from './types';

export {
  OciConfig,
  TokenExchangeConfig,
  UpstTokenResponse,
  TokenExchangeError
};

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
