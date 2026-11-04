# VNPAY execution ledger

Plan: 2026-11-04-vnpay-sandbox.md. Baseline main 7c67814, 214 tests passed. In-place dedicated branch chosen to preserve existing local environment and user-visible checkout; no separate worktree.

- Task 1: provider isolation SQL RED (old CHECK constraint) -> GREEN (rollback on linked dev database). Migration not deployed yet. Includes owner state API, immutable provider routing, private metadata and mock-only expiry updates.
- Configuration: user supplied sandbox credentials; stored only in gitignored .env.vnpay.local. Never log or commit values.
