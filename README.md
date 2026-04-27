# New API — ZGCI Fork

This is an internal fork of [new-api](https://github.com/QuantumNous/new-api), customized for ZGCI's internal AI gateway deployment.

## What's Changed

**Authentication & Access Control**
DingTalk SSO is integrated as the primary login method. Password-based registration is disabled by default, and password login is restricted to admin accounts only. A per-user LibreChat API token provisioning endpoint has been added for admin use.

**User Portal**
Non-admin users get a simplified layout with a dedicated home page showing API endpoint info, usage stats, a model usage chart, and recent request history. A model gallery page lists available models. The branding and header UI have been updated for ZGCI.

**Playground / Chat**
The navigation label was renamed from "Playground" to "Chat". The playground supports group-filtered model lists and image input. Various UI refinements were made to token management, padding, and key display.

**Miscellaneous**
Request stats now use the log table total for accuracy. Overflow and layout bugs on the home page have been fixed. A local hot backup script is included.

## Deployment

**Build the image:**

```bash
docker build -t new-api-local .
```

**Start the service:**

```bash
docker compose -f docker-compose.local.yml up -d
```

The service will be available on port `52100`.

**Stop the service:**

```bash
docker compose -f docker-compose.local.yml down
```
