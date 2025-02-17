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
deploy:
  image: node:20
  id_tokens:
    aud: https://cloud.oracle.com/gitlab
  before_script:
    - npm install -g @gtrevorrow/oci-token-exchange
    - curl -LO https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh
    - bash install.sh --accept-all-defaults
  script:
    - export CI_JOB_JWT_V2="$(cat $CI_JOB_JWT_FILE)"
    - |
      oci-token-exchange
      PLATFORM=gitlab \
      OIDC_CLIENT_ID=$OIDC_CLIENT_ID \
      DOMAIN_URL=$DOMAIN_URL \
      OCI_TENANCY=$OCI_TENANCY \
      OCI_REGION=$OCI_REGION
    - oci os ns get
```

### Bitbucket Pipelines
```yaml
pipelines:
  default:
    - step:
        image: node:20
        oidc: 
          audience: https://cloud.oracle.com/bitbucket
        script:
          - npm install -g @gtrevorrow/oci-token-exchange
          - curl -LO https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh
          - bash install.sh --accept-all-defaults
          - |
            oci-token-exchange
            PLATFORM=bitbucket \
            OIDC_CLIENT_ID=$OIDC_CLIENT_ID \
            DOMAIN_URL=$DOMAIN_URL \
            OCI_TENANCY=$OCI_TENANCY \
            OCI_REGION=$OCI_REGION
          - oci os ns get
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PLATFORM` | CI platform (github, gitlab, or bitbucket) | No (default: github) |
| `OIDC_CLIENT_ID` | OIDC client identifier | Yes |
| `DOMAIN_URL` | Base URL of OCI Identity Domain | Yes |
| `OCI_TENANCY` | OCI tenancy OCID | Yes |
| `OCI_REGION` | OCI region identifier | Yes |
| `RETRY_COUNT` | Number of retry attempts | No (default: 0) |

## How it Works

1. Generates an RSA key pair 
2. Requests a GitHub OIDC JWT token
3. Exchanges the JWT for an OCI UPST token
4. Configures the OCI CLI with the obtained credentials

## Semantic Versioning

This project follows semantic versioning powered by [semantic-release](https://github.com/semantic-release/semantic-release). Version numbers are automatically determined from commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Version Updates

The version number (MAJOR.MINOR.PATCH) is automatically incremented based on commit types:

- **MAJOR** version: Breaking changes
  - Triggered by commits containing `BREAKING CHANGE:` in body or footer
  - Example: `feat!: remove support for Node 16`

- **MINOR** version: New features
  - Triggered by `feat` type commits
  - Example: `feat(auth): add support for GitLab CI`

- **PATCH** version: Bug fixes and improvements
  - Triggered by `fix`, `perf`, or `refactor` type commits
  - Example: `fix(core): resolve token refresh issue`

### Other Commit Types

The following commit types will not trigger a version update:
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc)
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks
- `build`: Build system changes
- `ci`: CI configuration changes

### Examples

## License

This action is licensed under the [Universal Permissive License v1.0 (UPL-1.0)](LICENSE.txt).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
