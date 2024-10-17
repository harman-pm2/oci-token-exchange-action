"use strict";
/**
 * Copyright (c) 2021, 2024 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureOciCli = configureOciCli;
exports.main = main;
const io = __importStar(require("@actions/io"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
// Generate RSA key pair
const { publicKey, privateKey } = crypto_1.default.generateKeyPairSync('rsa', {
    modulusLength: 2048,
});
// Encode public key in a format teh OCI token exchange endpoint expects
function encodePublicKeyToBase64() {
    return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
}
//Calc OCI Domain Authorization Server confidential token exchange app client credential 
function calcClientCreds(clientId, clientSecret) {
    return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}
// Calculate the fingerprint of the OCI API public key
function calcFingerprint(publicKey) {
    const publicKeyData = publicKey.export({ type: 'spki', format: 'der' });
    const hash = crypto_1.default.createHash('MD5');
    hash.update(publicKeyData);
    return hash.digest('hex').replace(/(.{2})/g, '$1:').slice(0, -1);
}
// Debug print JWT token to the console
function debugPrintJWTToken(token) {
    if (core.isDebug()) {
        const tokenParts = token.split('.');
        core.debug(`JWT Header: ${Buffer.from(tokenParts[0], 'base64').toString('utf8')}`);
        core.debug(`JWT Payload: ${Buffer.from(tokenParts[1], 'base64').toString('utf8')}`);
    }
}
// Debug print message to the console
function debugPrint(message) {
    if (core.isDebug()) {
        console.debug(message);
    }
}
// Configure OCI CLI with the UPST token
async function configureOciCli(privateKey, publicKey, upstToken, ociFingerprint, ociTenancy, ociRegion) {
    // Setup OCI CLI configuration on the GitHub runner
    const home = process.env.HOME || '';
    if (!home) {
        throw new Error('HOME environment variable is not defined');
    }
    const ociConfigDir = path.join(home, '.oci');
    const ociConfigFile = path.join(ociConfigDir, 'config');
    const ociPrivateKeyFile = path.join(home, 'private_key.pem');
    const ociPublicKeyFile = path.join(home, 'public_key.pem');
    const upstTokenFile = path.join(home, 'session');
    debugPrint(`OCI Config Dir: ${ociConfigDir}`);
    const ociConfig = `[DEFAULT]
  user='not used'
  fingerprint=${ociFingerprint}
  key_file=${ociPrivateKeyFile}
  tenancy=${ociTenancy}
  region=${ociRegion}
  security_token_file=${upstTokenFile}
  `;
    // Ensure the OCI config directory exists
    await io.mkdirP(ociConfigDir);
    if (!fs.existsSync(ociConfigDir)) {
        throw new Error('Unable to create OCI Config folder');
    }
    core.debug(`Created OCI Config folder: ${ociConfig}`);
    // Write the OCI config file
    fs.writeFileSync(ociConfigFile, ociConfig);
    // Write the private key to a file at a location refrenced in the OCI ClI config file
    fs.writeFileSync(ociPrivateKeyFile, privateKey.export({ type: 'pkcs1', format: 'pem' }));
    // Set the appropriate permissions for the private key file
    fs.chmodSync(ociPrivateKeyFile, '600');
    fs.writeFileSync(ociPublicKeyFile, publicKey.export({ type: 'spki', format: 'pem' }));
    // Write the UPST/ Session Token to a file
    fs.writeFileSync(upstTokenFile, upstToken);
}
// Encapsulates the REST call to the OCI Domain OAuth token endpoint to exchange a GitHub OIDC ID Token for an OCI UPS token
async function tokenExchangeJwtToUpst(token_exchange_url, client_cred, oci_public_key, subject_token) {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${client_cred}`
    };
    const data = {
        'grant_type': 'urn:ietf:params:oauth:grant-type:token-exchange',
        'requested_token_type': 'urn:oci:token-type:oci-upst',
        'public_key': oci_public_key,
        'subject_token': subject_token,
        'subject_token_type': 'jwt'
    };
    core.debug('Token Exchange Request Data: ' + JSON.stringify(data));
    const response = await axios_1.default.post(token_exchange_url, data, { headers: headers });
    return response.data;
}
// Main function implements the control logic for the action
async function main() {
    try {
        // Input Handling
        const oidcClientIdentifier = core.getInput('oidc_client_identifier', { required: true });
        const domainBaseURL = core.getInput('domain_base_url', { required: true });
        const ociTenancy = core.getInput('oci_tenancy', { required: true });
        const ociRegion = core.getInput('oci_region', { required: true });
        // Get github OIDC JWT token
        const idToken = await core.getIDToken("https://cloud.oracle.com");
        if (!idToken) {
            throw new Error('Unable to obtain OIDC token');
        }
        debugPrintJWTToken(idToken);
        // Calculate the fingerprint of the public key
        const ociFingerprint = calcFingerprint(publicKey);
        // Get the B64 encoded public key DER
        let publicKeyB64 = encodePublicKeyToBase64();
        core.debug(`Public Key B64: ${publicKeyB64}`);
        //Exchange JWT to UPST
        let upstToken = await tokenExchangeJwtToUpst(`${domainBaseURL}/oauth2/v1/token`, Buffer.from(oidcClientIdentifier).toString('base64'), publicKeyB64, idToken);
        core.info(`OCI issued a Session Token`);
        //Setup the OCI cli/sdk on the github runner with the UPST token
        await configureOciCli(privateKey, publicKey, upstToken.token, ociFingerprint, ociTenancy, ociRegion);
        core.info(`OCI CLI has been configured to use the session token`);
        // Error Handling
    }
    catch (error) {
        core.setFailed(`Action failed with error: ${error}`);
    }
}
if (require.main === module) {
    main();
}
