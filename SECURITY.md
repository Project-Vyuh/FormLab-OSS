# Security Policy

## Supported Versions

Only the latest version of FormLab is currently supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

1.  **Do NOT open a public issue.**
2.  Email us at [security@example.com](mailto:security@example.com) (replace with actual contact).
3.  Provide a detailed description of the vulnerability and steps to reproduce it.

We will acknowledge your report within 48 hours and work with you to resolve the issue.

## API Keys and Secrets

- **Never** commit API keys or secrets to the repository.
- Use `.env.local` for local development.
- Ensure Firebase Security Rules are properly configured to protect user data.
