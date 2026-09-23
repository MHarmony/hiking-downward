# Security Policy

The HikingDownward project takes security reports seriously. This policy explains
which versions are supported, how to report a vulnerability privately, and what
reporters can expect from us.

## Supported Versions

HikingDownward is currently in active `0.x` development. Security fixes are
currently provided for the latest commit on the `main` branch and the latest
published release, when a published release exists.

| Version                  | Supported |
| ------------------------ | --------- |
| `main`                   | Yes       |
| Latest published release | Yes       |
| Older releases           | No        |

Because the project is pre-1.0, breaking changes may be included in security
fixes. Users should keep dependencies and deployments up to date.

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues,
pull requests, discussions, or social media.

The preferred reporting method is a private
[GitHub Security Advisory](https://github.com/MHarmony/hiking-downward/security/advisories/new).
If GitHub's private reporting form is unavailable, email
[contact@hikingdownward.com](mailto:contact@hikingdownward.com) with the subject
`[Security] Vulnerability report`.

Please include enough information for us to reproduce and assess the issue:

- A clear description of the vulnerability and its potential impact.
- The affected version, commit, package, route, or configuration.
- Reproduction steps or a minimal proof of concept.
- Relevant logs, screenshots, request/response samples, or stack traces with
  secrets and personal data removed.
- Any known mitigation or suggested fix.

Please allow us a reasonable opportunity to investigate and fix the issue before
making the report public. Do not include credentials, tokens, private user data,
or other secrets in a report.

## Response and Disclosure

- We aim to acknowledge a report within 5 business days.
- We aim to provide an initial assessment within 10 business days.
- We will coordinate a fix, release, and disclosure timeline with the reporter
  when the issue is confirmed.
- We may publish a GitHub Security Advisory, including credit to the reporter
  where requested and appropriate.
- We will not disclose a reporter's identity without permission, except where
  required by law.

These timelines are targets rather than contractual commitments. The timeline
may change based on severity, exploitability, affected users, and the complexity
of the fix.

## Scope

Reports are in scope when they demonstrate a security impact in HikingDownward,
its published source, or the project's maintained build and deployment
configuration. Vulnerabilities in third-party dependencies should be reported
to the relevant upstream maintainer as well, while still sharing an impact
assessment with us when HikingDownward is affected.

The following are generally not security vulnerabilities by themselves:

- Reports from unsupported or modified versions without reproduction on a
  supported version.
- Missing security headers on an unrelated deployment or hosting provider.
- Self-XSS, spam, social engineering, or denial-of-service testing that could
  affect availability.
- Automated scanner output without a demonstrated, reproducible impact.

## Safe Harbor

We support good-faith security research that follows this policy, avoids privacy
violations, data destruction, service degradation, and unauthorized access to
data, and stops testing once a vulnerability is confirmed. We will not pursue
legal action for accidental, good-faith violations of this policy. This safe
harbor does not authorize testing against infrastructure that we do not control
or waive any obligations imposed by law.

Thank you for helping keep HikingDownward and its users secure.
