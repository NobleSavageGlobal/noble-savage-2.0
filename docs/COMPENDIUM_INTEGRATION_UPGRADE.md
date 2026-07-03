# Noble Savage OS Compendium Integration Upgrade

## Core Principle

One brain, many doors. The compendium is an additive module of the same operating brain, not a separate product.

## Council Convergence

The Council of Twenty should map directly to historical masters with real biography, works, lineage, and source context.

Upgrade effect:
- Counsel becomes source-backed instead of generic.
- Morning/evening briefings can include cited passages.
- The same compendium intelligence flows through web, mobile wrappers, email, and push without per-device rewrites.

## Integration Contract

1. Keep all existing endpoints stable.
2. Add compendium endpoints under /comp/*.
3. Expand schema additively with new compendium tables.
4. Reuse council_convenings, briefings, and meals_today by enrichment fields.
5. Ensure council convene returns 1-2 scholars with context packet and citations.
6. Ensure briefing and meal payloads can carry compendium digest and safety context.

## Required API Additions

- /comp/scholars
- /comp/scholar/{id}
- /comp/scholar/{id}/works
- /comp/scholar/{id}/students
- /comp/scholar/{id}/teachers
- /comp/council/convene
- /comp/plants
- /comp/plant/{id}
- /comp/plant/{id}/safety
- /comp/plant/{id}/evidence
- /comp/plant/{id}/scholars
- /comp/garden/florida
- /comp/garden/design
- /comp/garden/calendar
- /comp/garden/plants/{id}
- /comp/texts
- /comp/text/{id}/references
- /comp/text/{id}/cite
- /comp/study/path
- /comp/study/advance
- /comp/study/recommend
- /comp/query

## Implementation Guidance

- Keep compendium entities global (scholars, works, plants, texts).
- Keep user-generated artifacts scoped by user_id (garden designs, study progress, convenings).
- Make /comp/query retrieval-first and citation-oriented.
- Add a Florida garden designer as a showcase location-aware feature.
- Keep safety fields first-class for any plant recommendation.

## Refined Prompt You Can Reuse

Analyze the current build against the Compendium Integration Upgrade spec and close all meaningful gaps.

Do this as an additive evolution of the existing system, not a rewrite:
- preserve existing APIs and behavior
- add the full /comp endpoint surface
- add compendium schema tables and seed baseline data
- map council convening to historical figures with context packets and citations
- integrate compendium intelligence into daily briefing, meal safety context, and study progression
- validate end-to-end with smoke tests and list any residual risks by severity.
