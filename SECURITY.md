# Security Policy

## Supported Versions

The following versions of OCI Token Exchange Action are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :heavy_check_mark: | 
| 0.x.x   | :x:                |

## Reporting a Vulnerability

Your efforts to responsibly disclose your findings is appreciated.

**Do not report security vulnerabilities through public GitHub issues.**

### How to Report

Please report security vulnerabilities using GitHub's Private Vulnerability Reporting feature:

1. Navigate to the repository on GitHub
2. Click on the "Security" tab
3. Select "Report a vulnerability"
4. Fill out the vulnerability report form with detailed information

For detailed instructions on how to use this feature, see the [GitHub documentation on privately reporting a security vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability#privately-reporting-a-security-vulnerability).

Your report should include:

1. Description of the vulnerability
2. Steps to reproduce the issue
3. Potential impact of the vulnerability
4. Suggested fix (if available)

### What to Expect

After submitting your report:

- You will receive acknowledgment of your report 
- An initial assessment will be provided within 10 business days

If the vulnerability is confirmed:
- I will develop and release a fix
- You will be credited for the discovery (unless you prefer to remain anonymous)

If the report is declined:
- I will provide a detailed explanation of our assessment

### Disclosure Policy

I follow coordinated vulnerability disclosure. I request that you:

- Allow me sufficient time to investigate and address the vulnerability before any public disclosure
- Avoid exploiting the vulnerability


## Security Best Practices for Users

When using OCI Token Exchange Action:

1. Always use the latest version
2. Store all credentials and tokens securely using your CI/CD platform's secret storage
3. Follow the principle of least privilege when configuring OCI policies
4. Regularly audit your workflow files to ensure they follow security best practices
5. Never expose OIDC client credentials in public repositories
