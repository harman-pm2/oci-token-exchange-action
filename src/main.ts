/**
 * Copyright (c) 2021, 2024 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */

import * as io from '@actions/io';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import crypto from 'crypto';
import axios from 'axios';
import * as github from '@actions/github';

// Define the UpstToken interface
interface UpstTokenResponse {
  token: string;
}

// Generate RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
});

function calc_fingerprint(publicKey: crypto.KeyObject) : string {
  const publicKeyData = publicKey.export({ type: 'spki', format: 'der' });
  const hash = crypto.createHash('MD5');
  hash.update(publicKeyData);
  return hash.digest('hex').replace(/(.{2})/g, '$1:').slice(0, -1).toUpperCase();
}

async function validate_oci_cli_installed_and_configured() {
  try {
      await exec.exec('oci', ['--version']);
  } catch (error) {
      
      throw new Error('OCI CLI is not installed or not configured');
  }
}

async function configure_oci_cli(privateKey: crypto.KeyObject, publicKey: crypto.KeyObject, upstToken: string, ociUser: string, ociFingerprint: string, ociTenancy: string, ociRegion: string) {
  // Setup and Initialization OCI CLI Profile
  const home = process.env.HOME || '';
  const ociConfigDir = path.join(home, '.oci');
  const ociConfigFile = path.join(ociConfigDir, 'config');
  const ociPrivateKeyFile = path.join(home, 'private_key.pem');
  const ociPublicKeyFile = path.join(home, 'public_key.pem');
  const upstTokenFile = path.join(home, 'session');

  console.debug(`OCI Config Dir: ${ociConfigDir}`);

  const ociConfig = `[DEFAULT]
  user=${ociUser}
  fingerprint=${ociFingerprint}
  key_file=${ociPrivateKeyFile}
  tenancy=${ociTenancy}
  region=${ociRegion}
  security_token=${upstTokenFile}
  `;

  await io.mkdirP(ociConfigDir);
  
  if (!fs.existsSync(ociConfigDir)) {
    throw new Error('Unable to create OCI Config folder');
  }
  console.debug(`Created OCI Config folder: ${ociConfig}`);

  fs.writeFileSync(ociConfigFile, ociConfig);
  fs.writeFileSync(
    ociPrivateKeyFile,
    privateKey.export({ type: 'pkcs1', format: 'pem' }) as string
  );

  fs.writeFileSync(
    ociPublicKeyFile,
    publicKey.export({ type: 'spki', format: 'pem' }) as string
  );

  fs.writeFileSync(upstTokenFile, upstToken);
}

async function token_exchange_jwt_to_upst(token_exchange_url: string, client_cred: string, oci_public_key: string, subject_token: string): Promise<any> {
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
  const response = await axios.post(token_exchange_url, data, { headers: headers });
  return response.data;
}

async function run(): Promise<void> {
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
    const ociFingerprint = calc_fingerprint(publicKey);

    // Get the B64 encoded public key DER
    let publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    console.debug(`Public Key B64: ${publicKeyB64}`);

    //Exchange JWT to UPST
    let upstToken: UpstTokenResponse = await token_exchange_jwt_to_upst(`${domainBaseURL}/oauth2/v1/token`, authStringEncoded, publicKeyB64, testToken?testToken : idToken);
    console.debug(`UPST Token:  ${upstToken.token}`);
    await configure_oci_cli(privateKey, publicKey, upstToken.token, ociUser, ociFingerprint, ociTenancy, ociRegion);

    // Error Handling
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
  }
}

run();
