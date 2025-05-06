"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenExchangeError = void 0;
exports.tokenExchangeJwtToUpst = tokenExchangeJwtToUpst;
exports.configureOciCli = configureOciCli;
exports.main = main;
/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const github_1 = require("./platforms/github");
const cli_1 = require("./platforms/cli");
const types_1 = require("./types");
Object.defineProperty(exports, "TokenExchangeError", { enumerable: true, get: function () { return types_1.TokenExchangeError; } });
const PLATFORM_CONFIGS = {
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
function createPlatform(platformType) {
    const config = PLATFORM_CONFIGS[platformType];
    if (!config) {
        throw new Error(`Unsupported platform: ${platformType}`);
    }
    return platformType === 'github' ? new github_1.GitHubPlatform() : new cli_1.CLIPlatform(config);
}
// Generate RSA key pair
const { publicKey, privateKey } = crypto_1.default.generateKeyPairSync('rsa', {
    modulusLength: 2048
});
async function delay(count) {
    return new Promise(resolve => setTimeout(resolve, 1000 * count));
}
// Encode public key in a format the OCI token exchange endpoint expects
function encodePublicKeyToBase64() {
    return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
}
// Calculate the fingerprint of the OCI API public key
function calcFingerprint(publicKey) {
    const publicKeyData = publicKey.export({ type: 'spki', format: 'der' });
    const hash = crypto_1.default.createHash('MD5');
    hash.update(publicKeyData);
    return hash.digest('hex').replace(/(.{2})/g, '$1:').slice(0, -1);
}
// Function to validate URLs
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch (_) {
        return false;
    }
}
/**
 * Performs a basic structural validation of a JWT and logs debug information.
 * @param platform The platform instance for logging.
 * @param token The JWT token string.
 */
function validateAndLogJwtStructure(platform, token) {
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
        }
        else {
            // If not 3 parts, log a warning. It might be an opaque token or malformed.
            platform.logger.debug(' OIDC token does not have the standard 3-part JWT structure.');
        }
    }
    catch (error) {
        platform.logger.warning(`Error during basic JWT structure check: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue, as the token might still be valid for exchange even if parsing failed here
    }
}
// Function to exchange JWT for OCI UPST token
async function tokenExchangeJwtToUpst(platform, { tokenExchangeURL, clientCred, ociPublicKey, subjectToken, retryCount, currentAttempt = 0 }) {
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
        const response = await axios_1.default.post(tokenExchangeURL, data, { headers });
        platform.logger.debug('Token Exchange Response: ' + JSON.stringify(response.data));
        return response.data; // auto wrapped in a Promise
    }
    catch (error) {
        const attemptCounter = currentAttempt ? currentAttempt : 0;
        if (retryCount > 0 && retryCount >= attemptCounter) {
            platform.logger.warning(`Token exchange failed, retrying ... (${retryCount - attemptCounter - 1} retries left)`);
            await delay(attemptCounter + 1);
            return tokenExchangeJwtToUpst(platform, {
                tokenExchangeURL,
                clientCred,
                ociPublicKey,
                subjectToken: subjectToken,
                retryCount,
                currentAttempt: attemptCounter + 1
            });
        }
        else {
            platform.logger.error('Failed to exchange JWT for UPST after multiple attempts');
            if (error instanceof Error) {
                throw new types_1.TokenExchangeError(`Token exchange failed: ${error.message}`, error);
            }
            else {
                throw new types_1.TokenExchangeError('Token exchange failed with an unknown error');
            }
        }
    }
}
// Update configureOciCli to accept platform as first parameter
// Add helpers for config merging and file writes
/**
 * Merge existing OCI config content by removing old profile section
 * and appending a new profile block.
 */
function mergeOciConfig(existingRaw, profileName, profileObject) {
    const lines = existingRaw.split('\n');
    const filtered = [];
    let skip = false;
    for (const line of lines) {
        if (line.trim() === `[${profileName}]`) {
            skip = true;
            continue;
        }
        if (skip && line.startsWith('[')) {
            skip = false;
        }
        if (!skip && line.trim() !== '') {
            filtered.push(line);
        }
    }
    const merged = filtered.length ? filtered.join('\n') + '\n' : '';
    const newSection = `[${profileName}]\n` +
        Object.entries(profileObject)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n') +
        '\n';
    return merged + newSection;
}
/**
 * Write data to a file and optionally set file permissions.
 */
async function writeAndChmod(filePath, data, perms) {
    await fs.writeFile(filePath, data);
    if (perms) {
        await fs.chmod(filePath, perms);
    }
}
async function configureOciCli(platform, config) {
    try {
        const home = config.ociHome || process.env.HOME || '';
        if (!home) {
            throw new types_1.TokenExchangeError('HOME environment variable is not defined');
        }
        // Sanitize file paths to prevent path injection
        const ociConfigDir = path.resolve(path.join(home, '.oci'));
        const ociConfigFile = path.resolve(path.join(ociConfigDir, 'config'));
        // Create a subfolder per profile to store keys and token
        const profileName = config.ociProfile || 'DEFAULT';
        // Ensure required OCI parameters are provided
        if (!config.ociTenancy) {
            throw new types_1.TokenExchangeError('OCI tenancy is not defined');
        }
        if (!config.ociRegion) {
            throw new types_1.TokenExchangeError('OCI region is not defined');
        }
        // Create a subfolder per profile to store keys and token
        const profileDir = path.resolve(path.join(ociConfigDir, profileName));
        const ociPrivateKeyFile = path.resolve(path.join(profileDir, 'private_key.pem'));
        const ociPublicKeyFile = path.resolve(path.join(profileDir, 'public_key.pem'));
        const upstTokenFile = path.resolve(path.join(profileDir, 'session'));
        platform.logger.debug(`OCI Config Dir: ${ociConfigDir}`);
        // Prepare profile object for INI
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
            // Also ensure directory for this profile exists
            await fs.mkdir(profileDir, { recursive: true });
        }
        catch (error) {
            throw new types_1.TokenExchangeError('Failed to create OCI Config folder', error);
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
        // Build and write all files using helpers
        try {
            const existingRaw = await fs.readFile(ociConfigFile, 'utf-8').catch(() => '');
            const finalContent = mergeOciConfig(existingRaw, profileName, profileObject);
            // Write config with secure permissions
            await writeAndChmod(ociConfigFile, finalContent, '600');
            platform.logger.debug(`Set permissions 600 on OCI config file ${ociConfigFile}`);
            // Write keys and token
            await writeAndChmod(ociPrivateKeyFile, privateKeyPem, '600');
            await writeAndChmod(ociPublicKeyFile, publicKeyPem);
            await writeAndChmod(upstTokenFile, config.upstToken, '600');
        }
        catch (err) {
            throw new types_1.TokenExchangeError('Failed to write OCI configuration files', err instanceof Error ? err : undefined);
        }
    }
    catch (error) {
        platform.setFailed(`Failed to configure OCI CLI: ${error}`);
        throw error;
    }
}
// Update debugPrintJWTToken to properly handle different token formats
function debugPrintJWTToken(platform, token) {
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
            }
            catch (e) {
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
            }
            catch (e) {
                platform.logger.debug(`Failed to parse JWT payload: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
            platform.logger.debug(`JWT Signature present: ${tokenParts[2].length > 0 ? 'Yes' : 'No'}`);
        }
        catch (error) {
            platform.logger.debug(`Error parsing JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
// Main function now creates a local platform instance and passes it to subfunctions
async function main() {
    const platformType = process.env.PLATFORM || 'github';
    if (!PLATFORM_CONFIGS[platformType]) {
        throw new Error(`Unsupported platform: ${platformType}`);
    }
    const platform = createPlatform(platformType);
    try {
        const config = ['oidc_client_identifier', 'domain_base_url', 'oci_tenancy', 'oci_region', 'oci_home', 'oci_profile']
            .reduce((acc, input) => ({
            ...acc,
            [input]: platform.getInput(input, input !== 'oci_home' && input !== 'oci_profile')
        }), {});
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
        const ociFingerprint = calcFingerprint(publicKey);
        // Get the B64 encoded public key DER
        const publicKeyB64 = encodePublicKeyToBase64();
        platform.logger.debug(`Public Key B64: ${publicKeyB64}`);
        //Exchange platform OIDC token for OCI UPST
        const upstToken = await tokenExchangeJwtToUpst(platform, {
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
        const ociConfig = {
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
    }
    catch (error) {
        if (error instanceof types_1.TokenExchangeError) {
            platform.setFailed(`Token exchange failed: ${error.message}`);
            if (error.cause) {
                platform.logger.debug(`Cause: ${error.cause}`);
            }
        }
        else {
            platform.setFailed(`Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        throw error;
    }
}
if (require.main === module) {
    main();
}
