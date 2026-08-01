# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The entire application and all tooling live in **`frontend/`** — `cd frontend` and run every command from there (package manager is `bun`; `bun run dev` / `build` / `test` / `typecheck` / `check`).

**Read `frontend/CLAUDE.md`** — it holds the full guidance: architecture (plugin registries, the transaction sequencer, server-only boundary, data layer, demo mode, design system) and the non-negotiable conventions that have caused real bugs when ignored. `frontend/SPECS.md` is the product/architecture source of truth.

Nothing else at the repo root matters for development (`review.sh` / `review_comments.txt` are scratch files).
