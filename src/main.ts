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

// Generate RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
});

async function token_exchange_jwt_to_upst(token_exchange_url: string, client_cred: string, oci_public_key: string, subject_token: string) {
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
    // Setup and Initialization
    const workspace = process.env.GITHUB_WORKSPACE || '';
    const tempDir = path.join(os.tmpdir(), 'my-action-temp');

    // Input Handling
    const clientId = core.getInput('client_id', { required: true });
    const clientSecret = core.getInput('client_secret', { required: true });
    const domainBaseURL = core.getInput('domain_base_url', { required: true });
    

    // Get github OIDC JWT token
    const idToken = await core.getIDToken();
    if (!idToken) {
      throw new Error('Unable to obtain OIDC token');
    }

    // Setup OCI Domain confidential application OAuth Client Credentials
    let clientCreds = `${clientId}:${clientSecret}`;
    let authStringEncoded = Buffer.from(clientCreds).toString('base64');

    // Get the B64 encoded public key DER
    let publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

    //Exchange JWT to UPST
    let upstToken = await token_exchange_jwt_to_upst(`${domainBaseURL}/oauth2/v1/token`, authStringEncoded, publicKeyB64, idToken);
    console.log(upstToken);

    // Save the UPST token to the file system
    fs.writeFileSync(path.join(workspace, 'upst_token.txt'), upstToken.access_token);

    //Save the private key to the file system in PEM format 
    fs.writeFileSync(path.join(workspace, 'private_key.pem'), privateKey.export({ type: 'pkcs1', format: 'pem' }) as string);

    // Error Handling
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
  }
}

run();