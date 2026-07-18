# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Architect OLNOO is an AI-assisted architectural design platform. Frontend implementation uses Next.js, TypeScript, Tailwind CSS, and the App Router.

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
- Frontend changes must preserve the existing Next.js, TypeScript, and Tailwind CSS stack.

## Working in This Repo

- When adding application code, place it under `src/` and update the relevant docs in `docs/` rather than duplicating architectural decisions in code comments.
- When adding a new feature or agent, add a corresponding spec file in `specs/` and list it in `specs/README.md`.
