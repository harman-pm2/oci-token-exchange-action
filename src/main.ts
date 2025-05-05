/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import * as TOML from '@iarna/toml';
import { Platform, PlatformConfig } from './platforms/types';
import { GitHubPlatform } from './platforms/github';
import { CLIPlatform } from './platforms/cli';
import {
  TokenExchangeConfig,
  OciConfig,
  ConfigInputs,
  UpstTokenResponse,
  TokenExchangeError
} from './types';

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  github: {
    audience: 'https://cloud.oracle.com'
  },
  gitlab: {
    tokenEnvVar: 'CI_JOB_JWT_V2',
    audience: 'https://cloud.oracle.com/gitlab'
  },
  bitbucket: {
    tokenEnvVar: 'BITBUCKET_STEP_OIDC_TOKEN',
    audience: 'https://cloud.oracle.com/bitbucket'
  },
  local: {
    tokenEnvVar: 'LOCAL_OIDC_TOKEN',
    audience: 'https://cloud.oracle.com'
  }
};

// Create platform instance based on environment
function createPlatform(platformType: string): Platform {
  const config = PLATFORM_CONFIGS[platformType];
  if (!config) {
    throw new Error(`Unsupported platform: ${platformType}`);
  }

  return platformType === 'github' ? new GitHubPlatform() : new CLIPlatform(config);
}

// Generate RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048
});

async function delay(count: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 1000 * count));
}

// Encode public key in a format the OCI token exchange endpoint expects
function encodePublicKeyToBase64(): string {
  return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
}

// Calculate the fingerprint of the OCI API public key
function calcFingerprint(publicKey: crypto.KeyObject): string {
  const publicKeyData = publicKey.export({ type: 'spki', format: 'der' });
  const hash = crypto.createHash('MD5');
  hash.update(publicKeyData);
  return hash.digest('hex').replace(/(.{2})/g, '$1:').slice(0, -1);
}

// Function to validate URLs
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Performs a basic structural validation of a JWT and logs debug information.
 * @param platform The platform instance for logging.
 * @param token The JWT token string.
 */
function validateAndLogJwtStructure(platform: Platform, token: string): void {
  if (!platform.isDebug()) {
    return; // Only run if debug mode is enabled
  }

  try {
    const parts = token.split('.');
    // Check if the token has the standard 3-part JWT structure
    if (parts.length === 3) {
      // Try to parse the token segments to validate it's a proper(ish) JWT
      // Note: This is a very basic check and does not guarantee the token's validity
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      platform.logger.debug(`JWT appears structured as expected (3 parts). Issuer: ${payload.iss || 'unknown'}, kid: ${header.kid || 'unknown'}`);
    } else {
      // If not 3 parts, log a warning. It might be an opaque token or malformed.
      platform.logger.debug(' OIDC token does not have the standard 3-part JWT structure.');
    }
  } catch (error) {
    platform.logger.warning(`Error during basic JWT structure check: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Continue, as the token might still be valid for exchange even if parsing failed here
  }
}

// Function to exchange JWT for OCI UPST token
export async function tokenExchangeJwtToUpst(
  platform: Platform,
  {
    tokenExchangeURL,
    clientCred,
    ociPublicKey,
    subjectToken,
    retryCount,
    currentAttempt = 0
  }: TokenExchangeConfig
): Promise<UpstTokenResponse> {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${clientCred}`
  };

  // Perform basic validation and logging if debug is enabled
  if (subjectToken) {
    validateAndLogJwtStructure(platform, subjectToken);
  }

  const data = {
    'grant_type': 'urn:ietf:params:oauth:grant-type:token-exchange',
    'requested_token_type': 'urn:oci:token-type:oci-upst',
    'public_key': ociPublicKey,
    'subject_token': subjectToken,
    'subject_token_type': 'jwt'
  };
  // Note that this will log potentially sensitive information but will leave it up to the user to decide if they want to enable debug logging with this risk
  platform.logger.debug('Token Exchange Request Data: ' + JSON.stringify(data));

  try {
    const response = await axios.post(tokenExchangeURL, data, { headers });
    platform.logger.debug('Token Exchange Response: ' + JSON.stringify(response.data));
    return response.data; // auto wrapped in a Promise
  } catch (error) {
    const attemptCounter = currentAttempt ? currentAttempt : 0;
    if (retryCount > 0 && retryCount >= attemptCounter) {
      platform.logger.warning(`Token exchange failed, retrying ... (${retryCount - attemptCounter - 1} retries left)`);
      await delay(attemptCounter + 1);
      return tokenExchangeJwtToUpst(platform, { // Promise flattening
        tokenExchangeURL,
        clientCred,
        ociPublicKey,
        subjectToken: subjectToken,
        retryCount,
        currentAttempt: attemptCounter + 1
      });
    } else {
      platform.logger.error('Failed to exchange JWT for UPST after multiple attempts');
      if (error instanceof Error) {
        throw new TokenExchangeError(`Token exchange failed: ${error.message}`, error);
      } else {
        throw new TokenExchangeError('Token exchange failed with an unknown error');
      }
    }
  }
}

// Update configureOciCli to accept platform as first parameter
export async function configureOciCli(platform: Platform, config: OciConfig): Promise<void> {
  try {
    const home: string = config.ociHome || process.env.HOME || '';
    if (!home) {
      throw new TokenExchangeError('HOME environment variable is not defined');
    }

    // Sanitize file paths to prevent path injection
    const ociConfigDir: string = path.resolve(path.join(home, '.oci'));
    const ociConfigFile: string = path.resolve(path.join(ociConfigDir, 'config'));
    const ociPrivateKeyFile: string = path.resolve(path.join(home, 'private_key.pem'));
    const ociPublicKeyFile: string = path.resolve(path.join(home, 'public_key.pem'));
    const upstTokenFile: string = path.resolve(path.join(home, 'session'));

    platform.logger.debug(`OCI Config Dir: ${ociConfigDir}`);

    // Build config section for the given profile
    const profileName = config.ociProfile || 'DEFAULT';
    // Prepare profile object for TOML
    const profileObject = {
      user: 'not used',
      fingerprint: config.ociFingerprint,
      key_file: ociPrivateKeyFile,
      tenancy: config.ociTenancy,
      region: config.ociRegion,
      security_token_file: upstTokenFile
    };

    platform.logger.debug(`Preparing OCI config for profile [${profileName}]`);

    try {
      await fs.mkdir(ociConfigDir, { recursive: true });
    } catch (error) {
      throw new Error('Unable to create OCI Config folder');
    }

    try {
      try {
        await fs.access(ociConfigFile);
        platform.logger.warning(`Overwriting existing config file at ${ociConfigFile}`);
      } catch (e) {
        // File does not exist, proceed silently
      }

      // Export and validate keys first
      const privateKeyPem = config.privateKey.export({ type: 'pkcs1', format: 'pem' });
      const publicKeyPem = config.publicKey.export({ type: 'spki', format: 'pem' });

      if (!privateKeyPem || typeof privateKeyPem !== 'string') {
        throw new Error('Private key export failed or invalid type');
      }
      if (!publicKeyPem || typeof publicKeyPem !== 'string') {
        throw new Error('Public key export failed or invalid type');
      }
      if (!config.upstToken || typeof config.upstToken !== 'string') {
        throw new Error('Session token is undefined or invalid type');
      }
      if (!profileObject || typeof profileObject !== 'object') {
        throw new Error('OCI config is undefined or invalid type');
      }

      platform.logger.debug('Validated all file contents before writing');

      // Read existing config file (if any)
      let existingContent = '';
      try {
        existingContent = await fs.readFile(ociConfigFile, 'utf-8');
      } catch {
        existingContent = '';
      }
      // Prepare a fresh object to merge existing TOML data into, avoiding mutation of parsing result
      const mergedConfig: Record<string, any> = {};
      // Merge existing TOML; if parse fails, ignore and start fresh (overwrite)
      if (existingContent) {
        try {
          Object.assign(mergedConfig, TOML.parse(existingContent));
        } catch {
          // Invalid TOML: skip merging and overwrite config entirely
        }
      }
      // Set or replace the profile section
      mergedConfig[profileName] = profileObject;
      const finalConfigContent = TOML.stringify(mergedConfig);
      await fs.writeFile(ociConfigFile, finalConfigContent);
      platform.logger.debug(`Successfully updated OCI config at ${ociConfigFile}`);

      // Write private key, public key, and session token
      await Promise.all([
        fs.writeFile(ociPrivateKeyFile, privateKeyPem)
          .then(() => fs.chmod(ociPrivateKeyFile, '600'))
          .then(() => platform.logger.debug(`Successfully wrote private key to ${ociPrivateKeyFile} with permissions 600`)),
        fs.writeFile(ociPublicKeyFile, publicKeyPem)
          .then(() => platform.logger.debug(`Successfully wrote public key to ${ociPublicKeyFile}`)),
        fs.writeFile(upstTokenFile, config.upstToken)
          .then(() => fs.chmod(upstTokenFile, '600'))
          .then(() => platform.logger.debug(`Successfully wrote session token to ${upstTokenFile}`))
      ]);
    } catch (error) {
      throw new TokenExchangeError('Failed to write OCI configuration files', error);
    }
  } catch (error) {
    platform.setFailed(`Failed to configure OCI CLI: ${error}`);
    throw error;
  }
}

// Update debugPrintJWTToken to properly handle different token formats
function debugPrintJWTToken(platform: Platform, token: string) {
  if (platform.isDebug()) {
    platform.logger.debug(`JWT Token received (length: ${token.length} characters)`);

    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        platform.logger.debug(`Warning: JWT token does not have the expected format (header.payload.signature)`);
        return;
      }

      // Only decode and print the header and selected parts of payload, not the full token
      const headerStr = Buffer.from(tokenParts[0], 'base64').toString('utf8');
      let header;
      try {
        header = JSON.parse(headerStr);
        platform.logger.debug(`JWT Header: ${JSON.stringify(header)}`);
      } catch (e) {
        platform.logger.debug(`Failed to parse JWT header: ${headerStr}`);
      }

      // Parse payload but only log safe information
      try {
        const payloadStr = Buffer.from(tokenParts[1], 'base64').toString('utf8');
        const payload = JSON.parse(payloadStr);
        const safePayload = {
          iss: payload.iss,
          aud: payload.aud,
          exp: payload.exp,
          iat: payload.iat,
          sub: payload.sub ? `${payload.sub.substring(0, 10)}...` : undefined,
          // Include timestamp information for troubleshooting token expiry issues
          expires_at: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined,
          issued_at: payload.iat ? new Date(payload.iat * 1000).toISOString() : undefined
        };

        platform.logger.debug(`JWT Payload (safe parts): ${JSON.stringify(safePayload)}`);
      } catch (e) {
        platform.logger.debug(`Failed to parse JWT payload: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }

      platform.logger.debug(`JWT Signature present: ${tokenParts[2].length > 0 ? 'Yes' : 'No'}`);
    } catch (error) {
      platform.logger.debug(`Error parsing JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}


// Main function now creates a local platform instance and passes it to subfunctions
export async function main(): Promise<void> {

  const platformType = process.env.PLATFORM || 'github';
  if (!PLATFORM_CONFIGS[platformType]) {
    throw new Error(`Unsupported platform: ${platformType}`);
  }
  const platform: Platform = createPlatform(platformType);
  try {

    const config = ['oidc_client_identifier', 'domain_base_url', 'oci_tenancy', 'oci_region', 'oci_home', 'oci_profile']
      .reduce<Partial<ConfigInputs>>((acc, input) => ({
        ...acc,
        [input]: platform.getInput(input, input !== 'oci_home' && input !== 'oci_profile')
      }), {}) as ConfigInputs;

    const retryCount = parseInt(platform.getInput('retry_count', false) || '0');
    if (isNaN(retryCount) || retryCount < 0) {
      throw new Error('retry_count must be a non-negative number');
    }

    // Validate the tokenExchangeURL
    if (!isValidUrl(`${config.domain_base_url}/oauth2/v1/token`)) {
      throw new Error('Invalid domain_base_url provided');
    }

    const idToken = await platform.getOIDCToken(PLATFORM_CONFIGS[platformType].audience);
    platform.logger.debug(`Token obtained from ${platformType}`);

    debugPrintJWTToken(platform, idToken);

    // Calculate the fingerprint of the public key
    const ociFingerprint: string = calcFingerprint(publicKey);

    // Get the B64 encoded public key DER
    const publicKeyB64: string = encodePublicKeyToBase64();
    platform.logger.debug(`Public Key B64: ${publicKeyB64}`);

    //Exchange platform OIDC token for OCI UPST
    const upstToken: UpstTokenResponse = await tokenExchangeJwtToUpst(platform, {
      tokenExchangeURL: `${config.domain_base_url}/oauth2/v1/token`,
      clientCred: Buffer.from(config.oidc_client_identifier).toString('base64'),
      ociPublicKey: publicKeyB64,
      subjectToken: idToken,
      retryCount
    });
    platform.logger.info(`OCI issued a Session Token `);

    // Resolve OCI home and profile, falling back to environment or defaults
    const resolvedOciHome = config.oci_home || process.env.OCI_HOME;
    const resolvedOciProfile = config.oci_profile || process.env.OCI_PROFILE || 'DEFAULT';
    const ociConfig: OciConfig = {
      ociHome: resolvedOciHome,
      ociProfile: resolvedOciProfile,
      privateKey,
      publicKey,
      upstToken: upstToken.token,
      ociFingerprint,
      ociTenancy: config.oci_tenancy,
      ociRegion: config.oci_region
    };

    await configureOciCli(platform, ociConfig);
    platform.logger.info(`OCI CLI has been configured to use the session token`);

    // Add success output
    platform.setOutput('configured', 'true');

    // Error Handling
  } catch (error) {
    if (error instanceof TokenExchangeError) {
      platform.setFailed(`Token exchange failed: ${error.message}`);
      if (error.cause) {
        platform.logger.debug(`Cause: ${error.cause}`);
      }
    } else {
      platform.setFailed(`Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    throw error;
  }
}

if (require.main === module) {
  main();
}

// Re-export the types for convenience
export { TokenExchangeError, TokenExchangeConfig, OciConfig };

