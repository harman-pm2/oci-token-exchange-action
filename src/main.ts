/**
 * Copyright (c) 2021, 2024 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { Platform, PlatformConfig } from './platforms/types';
import { GitHubPlatform } from './platforms/github';
import { CLIPlatform } from './platforms/cli';

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
  modulusLength: 2048,
});

async function delay(count: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 1000 * count));
}

// Encode public key in a format teh OCI token exchange endpoint expects
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

// Add interfaces for better type safety
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

// Add type for config object
interface ConfigInputs {
  oidc_client_identifier: string;
  domain_base_url: string;
  oci_tenancy: string;
  oci_region: string;
}

// Improve error handling with custom error class
class TokenExchangeError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TokenExchangeError';
  }
}

// Refactor token exchange function to use interface
async function tokenExchangeJwtToUpst({
  tokenExchangeURL,
  clientCred,
  ociPublicKey,
  subjectToken,
  retryCount,
  currentAttempt = 0
}: TokenExchangeConfig): Promise<UpstTokenResponse> {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${clientCred}`
  };
  const data = {
    'grant_type': 'urn:ietf:params:oauth:grant-type:token-exchange',
    'requested_token_type': 'urn:oci:token-type:oci-upst',
    'public_key': ociPublicKey,
    'subject_token': subjectToken,
    'subject_token_type': 'jwt'
  };
  platform.logger.debug('Token Exchange Request Data: ' + JSON.stringify(data));
  try {
    const response = await axios.post(tokenExchangeURL, data, { headers: headers });
    return response.data;
  } catch (error) {
    const attemptCounter = currentAttempt ? currentAttempt : 0;
    if (retryCount > 0 && retryCount >= attemptCounter ) {
      platform.logger.warning(`Token exchange failed, retrying ... (${retryCount - attemptCounter - 1} retries left)`);
      await delay(attemptCounter+1)
      return tokenExchangeJwtToUpst({ tokenExchangeURL, clientCred, ociPublicKey, subjectToken, retryCount, currentAttempt: attemptCounter + 1 });
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

// Refactor configureOciCli to use interface
export async function configureOciCli(config: OciConfig): Promise<void> {
  try {
    const home: string = process.env.HOME || '';
    if (!home) {
      throw new Error('HOME environment variable is not defined');
    }
    const ociConfigDir: string = path.join(home, '.oci');
    const ociConfigFile: string = path.join(ociConfigDir, 'config');
    const ociPrivateKeyFile: string = path.join(home, 'private_key.pem');
    const ociPublicKeyFile: string = path.join(home, 'public_key.pem');
    const upstTokenFile: string = path.join(home, 'session');

    debugPrint(`OCI Config Dir: ${ociConfigDir}`);

    const ociConfig: string = `[DEFAULT]
    user='not used'
    fingerprint=${config.ociFingerprint}
    key_file=${ociPrivateKeyFile}
    tenancy=${config.ociTenancy}
    region=${config.ociRegion}
    security_token_file=${upstTokenFile}
    `;

    // Create directory and check if it exists in one operation
    try {
      await fs.mkdir(ociConfigDir, { recursive: true });
    } catch (error) {
      throw new Error('Unable to create OCI Config folder');
    }

    platform.logger.debug(`Created OCI Config folder: ${ociConfig}`);

    // Check if files exist before writing
    try {
      await fs.access(ociConfigFile).then(() => {
        platform.logger.warning(`Overwriting existing config file at ${ociConfigFile}`);
      }).catch(() => {});

      // Write all files using promises
      await Promise.all([
        fs.writeFile(ociConfigFile, ociConfig),
        fs.writeFile(
          ociPrivateKeyFile,
          config.privateKey.export({ type: 'pkcs1', format: 'pem' }) as string
        ).then(() => fs.chmod(ociPrivateKeyFile, '600')),
        fs.writeFile(
          ociPublicKeyFile,
          config.publicKey.export({ type: 'spki', format: 'pem' }) as string
        ),
        fs.writeFile(upstTokenFile, config.upstToken)
      ]);
    } catch (error) {
      throw new TokenExchangeError('Failed to write OCI configuration files', error);
    }
  } catch (error) {
    platform.setFailed(`Failed to configure OCI CLI: ${error}`);
    throw error;
  }
}

// Encapsulates the REST call to the OCI Domain OAuth token endpoint to exchange a GitHub OIDC ID Token for an OCI UPS token
interface UpstTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let platform: Platform;

function debugPrintJWTToken(token: string) {
  if (platform.isDebug()) {
    const tokenParts = token.split('.');
    platform.logger.debug(`JWT Header: ${Buffer.from(tokenParts[0], 'base64').toString('utf8')}`);
    platform.logger.debug(`JWT Payload: ${Buffer.from(tokenParts[1], 'base64').toString('utf8')}`);
  }
}

function debugPrint(message: string) {
  if (platform.isDebug()) {
    platform.logger.debug(message);
  }
}

// Main function implements the control logic for the action
export async function main(): Promise<void> {
  try {
    const platformType = process.env.PLATFORM || 'github';
    if (!PLATFORM_CONFIGS[platformType]) {
      throw new Error(`Unsupported platform: ${platformType}`);
    }
    platform = createPlatform(platformType);
    
    // Use typed object for config
    const config = ['oidc_client_identifier', 'domain_base_url', 'oci_tenancy', 'oci_region']
      .reduce<Partial<ConfigInputs>>((acc, input) => ({
        ...acc,
        [input]: platform.getInput(input, true)
      }), {}) as ConfigInputs;

    const retryCount = parseInt(platform.getInput('retry_count', false) || '0');
    if (isNaN(retryCount) || retryCount < 0) {
      throw new Error('retry_count must be a non-negative number');
    }

    const idToken = await platform.getOIDCToken(PLATFORM_CONFIGS[platformType].audience);
    platform.logger.debug(`Token obtained from ${platformType}`);
    
    debugPrintJWTToken(idToken);

    // Calculate the fingerprint of the public key
    const ociFingerprint: string = calcFingerprint(publicKey);

    // Get the B64 encoded public key DER
    let publicKeyB64: string = encodePublicKeyToBase64();
    platform.logger.debug(`Public Key B64: ${publicKeyB64}`);

    //Exchange JWT to UPST
    let upstToken: UpstTokenResponse = await tokenExchangeJwtToUpst({
      tokenExchangeURL: `${config.domain_base_url}/oauth2/v1/token`,
      clientCred: Buffer.from(config.oidc_client_identifier).toString('base64'),
      ociPublicKey: publicKeyB64,
      subjectToken: idToken,
      retryCount
    });
    platform.logger.info(`OCI issued a Session Token`);

    //Setup the OCI cli/sdk on the github runner with the UPST token
    const ociConfig: OciConfig = {
      privateKey,
      publicKey,
      upstToken: upstToken.access_token,
      ociFingerprint,
      ociTenancy: config.oci_tenancy,
      ociRegion: config.oci_region
    };

    await configureOciCli(ociConfig);
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

// Add proper exports
export { TokenExchangeError, TokenExchangeConfig, OciConfig };

