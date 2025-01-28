#!/usr/bin/env node

import { main } from './main';

// Map environment variables to GitHub Actions input format
const envVars: Record<string, string> = {
  PLATFORM: 'platform',
  OIDC_CLIENT_ID: 'oidc_client_identifier',
  DOMAIN_URL: 'domain_base_url',
  OCI_TENANCY: 'oci_tenancy',
  OCI_REGION: 'oci_region',
  RETRY_COUNT: 'retry_count'
};

// Set environment variables in GitHub Actions format
Object.entries(envVars).forEach(([envVar, inputName]) => {
  const value = process.env[envVar];
  if (value) {
    process.env[`INPUT_${inputName.toUpperCase()}`] = value;
  }
});

// Run the main function
main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
