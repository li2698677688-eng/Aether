# Security policy

## Supported versions

Security fixes are provided for the latest release on `main`. Pre-release and
older tags may receive fixes only when the same change applies cleanly.

## Report privately

Do not open a public issue for a suspected vulnerability. Use GitHub's
**Report a vulnerability** action on the Security tab of
`li2698677688-eng/Aether`. Include affected routes or revisions, impact,
reproduction steps, and a minimal proof of concept. Do not include real user
data, production credentials, or destructive payloads.

We aim to acknowledge a report within 3 business days, provide an initial
assessment within 7 business days, and coordinate disclosure after a fix is
available. These are response goals, not a bug-bounty promise.

## High-risk surfaces

Aether treats submitted URLs, remote DOM/CSS, third-party assets, model output,
compiler output, callbacks, and contributions as untrusted. Reports involving
SSRF or DNS rebinding, prompt injection, browser automation escape, cross-tenant
private objects, artifact hash bypass, code execution, credential exposure,
authorization, webhook replay, or supply-chain compromise are especially
valuable.

The project does not currently offer a paid vulnerability reward. Good-faith
research that respects privacy, avoids persistence and service disruption, and
uses the private channel will be handled in good faith.
