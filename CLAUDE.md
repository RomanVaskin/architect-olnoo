# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Architect OLNOO is an AI-assisted architectural design platform. The MVP frontend uses Next.js App Router, TypeScript, Tailwind CSS, and typed mock data.

## Non-negotiable design direction

- Read `docs/10-DESIGN-SYSTEM.md` before creating or changing any interface.
- Use the official cropped wordmark at `public/olnoo-logo.svg` without redrawing it.
- Do not use any code, components, styles, screenshots, or layout decisions from the discarded v0 generation.
- Keep the interface white, calm, minimal, and consistent with the wider OLNOO product family.
- Do not modify the Supabase schema unless the user explicitly approves a reviewed migration.
- The configured Supabase MCP connection is intentionally read-only during the design stage.

## Repository Structure

```
architect-olnoo/
├── docs/     # Architecture and product documentation (numbered 00-10)
├── specs/    # Detailed specs for individual features and AI agents
└── src/      # Next.js application source code
```

- `docs/README.md` — index of all documents in `docs/` with their purpose
- `specs/README.md` — index of all specs in `specs/` with their purpose

## Conventions

- Every document in `docs/` and `specs/` starts with a title, `Version`, `Status`, `Last Updated`, and a one-line purpose summary.
- Changes are logged in `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/).
- Preserve the approved Next.js, TypeScript, and Tailwind CSS stack documented in `docs/02-PLATFORM-ARCHITECTURE.md`.

## Working in This Repo

- When adding application code, place it under `src/` and update the relevant docs in `docs/` rather than duplicating architectural decisions in code comments.
- When adding a new feature or agent, add a corresponding spec file in `specs/` and list it in `specs/README.md`.
