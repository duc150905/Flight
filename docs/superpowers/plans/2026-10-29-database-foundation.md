# Database foundation execution

Approved spec: docs/DATABASE-PROPOSAL.md (22 tables).
Target: flight-dev / qisvuxiuwsqtkcrfpiwu. Other projects must not be modified.

Scope: tables, types, checks, composite foreign keys, indexes, RLS/grants,
profile bootstrap/timestamps, role helper and safe read RPCs. Checkout/admin
write RPCs are subsequent feature work; deny direct writes in the meantime.

- [x] Verify authenticated CLI and matching target; public/private contain no tables.
- [x] Run foundation assertions red before deploying (expected 22, found 0).
- [x] Write/review schema SQL and apply atomically through Management API.
- [x] Run rollback-only RLS and constraint tests as anon/authenticated roles.
- [x] Run advisors and resolve applicable schema/security findings.
- [x] Save migration history/type definitions and document remaining feature RPCs.

Static reviewer caught a whitespace edge case in profile bootstrap and missing
baggage field validation; fixed both and added regression assertions. SQL role
tests passed before and after combining SELECT policies. Hosted helper client
EXECUTE permissions were revoked without changing its event trigger behavior.

Local/remote migration versions match. db pull/replay could not complete because
Docker daemon is stopped; this limitation and intentional advisor INFO findings
are recorded in docs/DATABASE.md. No checkout/admin write RPCs or seed data added.

Use Windows trusted public CA certificates for CLI TLS. Do not disable TLS
verification, print credentials or commit certificate bundles or CLI temp files.
