mhtradingeu-oss: PHASE 2 — FULL REPO BLUEPRINT (OPTION A) — BEGIN

You are Codex, the Lead System Architect and Principal Engineer for the MH-OS SUPERAPP.

You have already produced an initial high-level architecture and Phase 1 plan.

Now your job in PHASE 2 is to align REALITY (code) with the BLUEPRINT (docs) and produce a unified, precise, execution-ready architecture + gap report.

You must analyze:

All code

All docs

All legacy modules

You must NOT write any code yet.
This phase is analysis + unification only.

1 — SCOPE OF ANALYSIS (FULL REPO)

You MUST scan and understand the entire repository:

1.1 Code

/back-end

Express/NodeJS structure

Prisma schema

Seeding logic

Auth system

Brand system

Product + Pricing engine

CSV import pipeline

AI/Pricing advisor modules

Any utilities or shared services

/front-end

Next.js (app router / pages)

Routing

API integration layer

UI structure and layout

Any admin / partner / dashboard UIs

/mh-trading-os-legacy

Legacy Node/TS code

Legacy pricing logic

CSV/ETL pipelines

Any automation scripts

Any old experimental modules

/superapp

Current state (likely empty or scaffold-only)

Intended as the final unified app root

1.2 Documentation

You must also read and ingest all:

/doc/os/**/*.md

/doc/ai/**/*.md

Plus any included or clearly related documents (PDF / CSV / DOCX) that define:

Business OS

Pricing model

Stand program

Loyalty program

Dealer program

Affiliate program

White label program

CRM / Sales / Partner OS

AI workforce & agents

Automation flows

Security & governance

Folder structure master

API / DB master specs

These documents represent the business source of truth.

2 — CONFLICT RESOLUTION & UNIFICATION RULES

The repository contains:

New code (back-end & front-end)

Legacy code (mh-trading-os-legacy)

Multiple blueprint documents

Possibly duplicated or conflicting:

Discount percentages

Commission structures

Tiers/levels per program

Pricing rules

Naming conventions

Architectures

You MUST NOT simply mirror inconsistencies.

Instead, you MUST:

2.1 Detect

Where code and docs diverge:

Features described in docs but missing in code

Features in code but not in docs

Different values for the same thing (discounts, margins, levels, rules)

Conflicting architectural assumptions (e.g. modules vs services)

2.2 Normalize & Unify

You must propose one unified, coherent model for:

Pricing & margins per channel (B2C, Dealer, Stand, Amazon, etc.)

Dealer program structure

Stand program structure

Sales rep commissions

Loyalty points & tiers

Affiliate rules

White label & partner logic

AI layers (pricing, marketing, sales, finance, ops)

Folder structure & module boundaries

If different values or designs appear in different places:

Compare them

Choose the strongest, most scalable version

Or design a new unified model inspired by all inputs

Explain your reasoning

Think like:

Chief Architect

Chief Product Designer

Chief Economist for the partner programs

3 — OUTPUT FORMAT FOR PHASE 2

Your answer MUST be structured into 3 main sections, each detailed and concrete.

SECTION 1 — UNIFIED ARCHITECTURE (REALITY-AWARE)

Take your initial architecture proposal from Phase 1
and update/refine it based on the ACTUAL repo.

You must describe:

Recommended Repo Structure (final)

What belongs in /superapp

What stays in /back-end and /front-end

Which parts of /mh-trading-os-legacy should be:

Reused as-is

Refactored and migrated

Archived and never touched again

Domain & Module Map (Reality + Blueprint merged)
For each major domain:

Auth & User Management

Brand & Product OS

Pricing Engine

CRM OS

Sales Reps OS

Dealer OS

Stand Program OS

Loyalty OS

Affiliate OS

Partner / White Label OS

AI Pricing OS

AI Marketing OS

Automation OS

Notification OS

Finance OS

Superadmin Governance OS

AI Brain / AI Workforce

Describe:

What currently exists in code (brief summary)

What exists in docs but not in code

What the final target architectural module should look like

Which directory/package should own it (e.g. /superapp/packages/pricing etc.)

Service Boundaries & Layering

Based on the current code + docs, propose:

Final layered architecture:

Application layer

Domain layer

Infrastructure layer

Clear boundaries:

What is a core domain?

What is supporting?

What can be extracted later into microservices?

How to structure:

Shared types

Shared services

Shared infrastructure (Prisma, logging, events)

AI & Automation Integration

Explain clearly:

How AI agents will plug into:

Pricing

Sales

Marketing

Finance

Operations

Where automation and event-bus belong in the repo:

E.g. /superapp/packages/automation, /superapp/packages/notification-bus

Which existing code (e.g. pricing advisor, dynamic pricing) is:

Already aligned with the blueprint

Needs refactor

Needs to be wrapped with AI orchestration

SECTION 2 — GAP ANALYSIS (REALITY VS BLUEPRINT)

Here you must list concrete, actionable gaps, not abstract ideas.

For each domain/system:

Code Gaps

Features described in docs but missing in code

Modules partially implemented

Legacy modules that need refactor

Doc Gaps

Code that exists but is not documented

Business logic only in code, missing from OS docs

Old docs that conflict with new implementation

Data & Rules Gaps

Inconsistent:

Discounts

Commissions

Loyalty points

Stand levels

Dealer tiers

Pricing rules

For each, indicate:

Where the values differ

What you recommend as the final unified version

Technical Risks

Areas of code that:

Are risky to reuse

Need rewrite (e.g. untyped / messy / not aligned with architecture)

Dependencies or patterns that should be phased out

Priority Tags

Mark each gap as:

P0 — Must be fixed before serious development

P1 — Should be fixed early

P2 — Nice to have / can wait

SECTION 3 — PHASE 1 (SUPERAPP) EXECUTION PLAN — REFINED

You already proposed a Phase 1 earlier.
Now, refine it using what you saw in the real repo.

You must output a step-by-step plan for the next phase of work, including:

Monorepo/Folder Actions

What to scaffold in /superapp

What to move from /back-end and /front-end

What to leave as legacy/reference only

Migration Actions

Which pricing logic / CSV imports / AI pricing pieces to:

Extract

Wrap

Refactor

Core Foundations to Build First
In order, recommend what Codex should build before anything else, e.g.:

Unified Prisma schema package

Shared types package

Event bus / notification bus

Auth & tenant/brand context

Product + Pricing core domain

AI & automation integration layer (skeleton only)

Admin / Superadmin shell UI

Concrete Task List

Provide a numbered list of implementation tasks, for example:

TASK 1: Create /superapp structure with apps + packages…

TASK 2: Extract and centralize Prisma schema into /superapp/packages/prisma…

TASK 3: Implement unified event bus interface…

TASK 4: Migrate existing pricing engine into new pricing domain module…

…

Each task should be:

Clear

Atomic

Mappable directly to coding work

What NOT to Touch (Yet)

Explicitly list:

Which parts of the repo should remain untouched in Phase 1 of SuperApp build

Which legacy folders are reference-only

4 — RULES OF OPERATION (PHASE 2)

DO NOT write or modify any source code.

DO NOT create or rename files.

DO NOT run any commands.

Only:

Read

Analyze

Compare docs & code

Design & plan

When you are done, output:

MH-OS SUPERAPP — PHASE 2 FULL REPO BLUEPRINT (OPTION A)
with the 3 sections as described above.

PHASE 2 — FULL REPO BLUEPRINT (OPTION A) — END