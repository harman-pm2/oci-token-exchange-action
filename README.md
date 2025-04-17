# OCI Token Exchange

A tool to exchange OIDC tokens for OCI session tokens, supporting multiple CI platforms:
- GitHub Actions
- GitLab CI
- Bitbucket Pipelines

## Installation

### As GitHub Action
```yaml
- uses: gtrevorrow/oci-token-exchange-action@v1
```

### As CLI Tool
```bash
npm install -g @gtrevorrow/oci-token-exchange
```

## Usage

### GitHub Actions
```yaml
- uses: gtrevorrow/oci-token-exchange-action@v1
  with:
    oidc_client_identifier: ${{ secrets.OIDC_CLIENT_ID }}
    domain_base_url: ${{ secrets.DOMAIN_URL }}
    oci_tenancy: ${{ secrets.OCI_TENANCY }}
    oci_region: ${{ secrets.OCI_REGION }}
```

### GitLab CI
```yaml
# Use these YAML anchors to setup common tasks
.oci_setup: &oci_setup |
  curl -LO https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh
  bash install.sh --accept-all-defaults
  source ~/.bashrc

.clone_build_cli: &clone_build_cli |
  git clone https://github.com/gtrevorrow/oci-token-exchange-action.git
  cd oci-token-exchange-action
  npm ci
  npm run build:cli

deploy:
  script:
    # Install OCI CLI
    - *oci_setup
    
    # Clone and build the token exchange CLI
    - *clone_build_cli
    
    # Export token from GitLab CI
    - export CI_JOB_JWT_V2="$(cat $CI_JOB_JWT_FILE)"
    
    # Run the CLI
    - |
      cd dist &&
      PLATFORM=gitlab \
      OIDC_CLIENT_ID=${OIDC_CLIENT_ID} \
      DOMAIN_URL=${DOMAIN_URL} \
      OCI_TENANCY=${OCI_TENANCY} \
      OCI_REGION=${OCI_REGION} \
      RETRY_COUNT=3 \
      node cli.js
    
    # Verify OCI CLI configuration works
    - cd ../..
    - oci os ns get
  
  # Run only on main branch
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  
  # Configure OIDC token for GitLab
  id_tokens:
    ID_TOKEN:
      aud: https://cloud.oracle.com/gitlab
```

### Bitbucket Pipelines
```yaml
image: node:20

pipelines:
  default:
    - step:
        name: Setup OCI CLI with OIDC Token Exchange
        oidc: true  # Enable OIDC for Bitbucket
        script:
          # Setup OCI CLI
          - curl -LO https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh
          - bash install.sh --accept-all-defaults
          - export PATH=$PATH:/root/bin
          
          # Clone and build the token exchange CLI from GitHub
          - git clone https://github.com/gtrevorrow/oci-token-exchange-action.git
          - cd oci-token-exchange-action
          - npm ci
          - npm run build:cli
          
          # Run the CLI for token exchange
          - >
            cd dist &&
            export PLATFORM=bitbucket &&
            export OIDC_CLIENT_ID=${OIDC_CLIENT_ID} &&
            export DOMAIN_URL=${DOMAIN_URL} &&
            export OCI_TENANCY=${OCI_TENANCY} &&
            export OCI_REGION=${OCI_REGION} &&
            export RETRY_COUNT=3
          - node cli.js || exit 1
          
          # Verify OCI CLI works with generated token
          - cd ../..
          - oci os ns get
        
        # Preserve credentials for subsequent steps
        artifacts:
          - ".oci/**"
          - "private_key.pem"
          - "public_key.pem"
          - "session"
```

### Standalone CLI Usage
```bash
# Install globally
npm install -g @gtrevorrow/oci-token-exchange

# Run with required environment variables
export LOCAL_JWT_TOKEN="your.jwt.token"
PLATFORM=local \
OIDC_CLIENT_ID=your-client-id \
DOMAIN_URL=https://your-domain.identity.oraclecloud.com \
OCI_TENANCY=your-tenancy-ocid \
OCI_REGION=your-region \
oci-token-exchange

# Use the configured OCI CLI
oci os ns get
```

### Debugging

To enable detailed logging, set the `DEBUG` environment variable to `true`:

```bash
export DEBUG=true
```

This will log additional information, such as token exchange requests and responses, to help with troubleshooting.

## Environment Variables / Github Secrets 

The action supports flexible environment variable naming to make it easier to use across different platforms:

| Variable | Alternate Names | Description | Required |
|----------|----------------|-------------|----------|
| `OIDC_CLIENT_IDENTIFIER` | `INPUT_OIDC_CLIENT_IDENTIFIER` | OIDC client identifier | Yes |
| `DOMAIN_BASE_URL` | `INPUT_DOMAIN_BASE_URL` | Base URL of OCI Identity Domain | Yes |
| `OCI_TENANCY` | `INPUT_OCI_TENANCY` | OCI tenancy OCID | Yes |
| `OCI_REGION` | `INPUT_OCI_REGION` | OCI region identifier | Yes |
| `PLATFORM` | `INPUT_PLATFORM` | CI platform (`github`, `gitlab`, `bitbucket`, or `local`) | No (default: `github`) |
| `RETRY_COUNT` | `INPUT_RETRY_COUNT` | Number of retry attempts | No (default: `0`) |
| `LOCAL_OIDC_TOKEN` | - | OIDC token when using PLATFORM=local | Yes, when platform=local |
| `CI_JOB_JWT_V2` | - | GitLab CI JWT token | Yes, when platform=gitlab |
| `BITBUCKET_STEP_OIDC_TOKEN` | - | Bitbucket OIDC token | Yes, when platform=bitbucket |
| `DEBUG` | - | Enable debug output | No (default: `false`) |

### Environment Variable Handling

Variables can be provided in two ways:

1. **GitHub Actions Format**: Variables in the format `INPUT_VARIABLE_NAME` (used by GitHub Actions)
2. **Standard Format**: Plain environment variables matching the exact names listed above

The GitHub Action automatically maps variables from GitHub's format to the standard format, but if you're using the CLI directly, use the variable names exactly as shown above.


## How it Works

1. Generates an RSA key pair 
2. Requests a GitHub OIDC JWT token
3. Exchanges the JWT for an OCI UPST token
4. Configures the OCI CLI with the obtained credentials

## Semantic Versioning

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and publishing.  
**For details on the build and release process, see [CONTRIBUTING.md](./CONTRIBUTING.md).**

## License

This action is licensed under the [Universal Permissive License v1.0 (UPL-1.0)](LICENSE.txt).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
