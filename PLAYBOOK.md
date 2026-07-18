# OLNOO Engineering Playbook

Version: 1.0
Status: Active

---

# Purpose

This document defines the engineering workflow, development standards and AI collaboration rules for every OLNOO project.

Every developer and every AI assistant must read this document before starting work.

If this document conflicts with another document, this document has priority unless explicitly stated otherwise.

---

# Core Principles

1. Simplicity over complexity.
2. Architecture before implementation.
3. Reuse before duplication.
4. Documentation follows important changes.
5. Preserve existing functionality.
6. Never break production intentionally.
7. Think before coding.

---

# Terminal First

## Rule

The terminal is the primary development interface.

Whenever a task can be completed through the terminal, it must be completed through the terminal.

## Includes

- navigation
- file creation
- editing
- moving files
- deleting files
- git
- package management
- testing
- builds
- deployments
- searching
- logs
- diagnostics

## Avoid

Do not describe or perform GUI-based workflows if the same result can be achieved through the terminal.

GUI tools are allowed only when they provide functionality unavailable from the terminal (for example Figma or browser-based visual inspection).

---

# AI Workflow

Before starting any task:

1. Read CLAUDE.md
2. Read PLAYBOOK.md
3. Understand the task completely.
4. Identify risks.
5. Propose architecture if required.
6. Implement only after understanding.

Never start coding immediately without understanding the problem.

---

# Model Selection

Every task should explicitly specify the recommended Claude model.

Examples:

Model: Fable 5

or

Model: Standard Claude

---

# Development Rules

Prefer:

- clean code
- reusable components
- readable code
- explicit naming
- predictable behavior

Avoid:

- duplicated code
- unnecessary abstractions
- hidden side effects
- breaking APIs

---

# Architecture Rules

Do not change project architecture without approval.

Do not introduce new frameworks without approval.

Prefer extending existing architecture instead of replacing it.

Large refactoring must be discussed first.

---

# Git Workflow

For every completed task:

1. Verify the implementation.
2. Run project checks.
3. Build the project.
4. Commit changes.

Never push unless explicitly requested.

---

# Documentation

Update documentation only when changes affect:

- architecture
- workflow
- APIs
- UX
- project structure
- developer onboarding

Avoid documentation for trivial code changes.

---

# Testing

Whenever applicable:

Run:

tsc --noEmit

Run project build.

Fix errors before considering the task complete.

---

# Communication

Be transparent.

If something is uncertain, say so.

Do not invent facts.

Explain important architectural decisions.

---

# Definition of Done

A task is complete only if:

- implementation is finished
- checks pass
- build succeeds
- documentation is updated if necessary
- commit is created
- push has NOT been performed unless requested

---

# Continuous Improvement

This document is expected to evolve.

Every important engineering decision should improve this playbook.
