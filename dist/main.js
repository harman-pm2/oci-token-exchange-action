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
const io = __importStar(require("@actions/io"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
// Generate RSA key pair
const { publicKey, privateKey } = crypto_1.default.generateKeyPairSync('rsa', {
    modulusLength: 2048,
});
async function calc_fingerprint(publicKey) {
    const publicKeyData = publicKey.export({ type: 'spki', format: 'der' });
    const hash = crypto_1.default.createHash('sha256');
    hash.update(publicKeyData);
    return hash.digest('base64');
}
async function validate_oci_cli_installed_and_configured() {
    try {
        await exec.exec('oci', ['--version']);
    }
    catch (error) {
        throw new Error('OCI CLI is not installed or not configured');
    }
}
async function configure_oci_cli(privateKey, publicKey, upstToken, ociUser, ociFingerprint, ociTenancy, ociRegion) {
    // Setup and Initialization OCI CLI Profile
    const home = process.env.HOME || '';
    const ociConfigDir = path.join(home, '.oci');
    const ociConfigFile = path.join(ociConfigDir, 'config');
    const ociPrivateKeyFile = path.join(home, 'private_key.pem');
    const ociPublicKeyFile = path.join(home, 'public_key.pem');
    const upstTokenFile = path.join(home, 'session');
    const ociConfig = `[DEFAULT]
  user=${ociUser}
  fingerprint=${ociFingerprint}
  key_file=${ociPrivateKeyFile}
  tenancy=${ociTenancy}
  region=${ociRegion}
  security_token=${upstTokenFile}
  `;
    await io.mkdirP(ociConfigDir);
    fs.writeFileSync(ociConfigFile, ociConfig);
    fs.writeFileSync(ociPrivateKeyFile, privateKey.export({ type: 'pkcs1', format: 'pem' }));
    fs.writeFileSync(ociPublicKeyFile, publicKey.export({ type: 'spki', format: 'pem' }));
    fs.writeFileSync(upstTokenFile, upstToken);
}
async function token_exchange_jwt_to_upst(token_exchange_url, client_cred, oci_public_key, subject_token) {
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
    const response = await axios_1.default.post(token_exchange_url, data, { headers: headers });
    return response.data;
}
async function run() {
    try {
        // Input Handling
        const clientId = core.getInput('client_id', { required: true });
        const clientSecret = core.getInput('client_secret', { required: true });
        const domainBaseURL = core.getInput('domain_base_url', { required: true });
        const ociUser = core.getInput('oci_user', { required: true });
        const ociTenancy = core.getInput('oci_tenancy', { required: true });
        const ociRegion = core.getInput('oci_region', { required: true });
        const testToken = core.getInput('test_token', { required: true });
        // Get github OIDC JWT token
        const idToken = await core.getIDToken();
        if (!idToken) {
            throw new Error('Unable to obtain OIDC token');
        }
        console.debug(`ID Token: ${idToken}`);
        // Setup OCI Domain confidential application OAuth Client Credentials
        let clientCreds = `${clientId}:${clientSecret}`;
        let authStringEncoded = Buffer.from(clientCreds).toString('base64');
        const ociFingerprint = await calc_fingerprint(publicKey);
        // Get the B64 encoded public key DER
        let publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
        console.debug(`Public Key B64: ${publicKeyB64}`);
        //Exchange JWT to UPST
        let upstToken = await token_exchange_jwt_to_upst(`${domainBaseURL}/oauth2/v1/token`, authStringEncoded, publicKeyB64, testToken ? testToken : idToken);
        console.debug(`UPST Token:  ${upstToken.token}`);
        await configure_oci_cli(privateKey, publicKey, upstToken.token, ociUser, ociFingerprint, ociTenancy, ociRegion);
        // Error Handling
    }
    catch (error) {
        core.setFailed(`Action failed with error: ${error}`);
    }
}
run();
