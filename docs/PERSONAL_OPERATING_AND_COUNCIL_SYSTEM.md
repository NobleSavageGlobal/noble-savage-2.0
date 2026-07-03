# Personal Operating and Council System

This document defines the implementation baseline for Noble Savage OS personal-operating and advisory behavior.

Scope:
- User model schema and update logic
- Council routing engine
- Daily planning algorithm
- Lunar build/integrate cycle engine
- Learning loop
- Daily briefing format
- Data sources and stack integration details

## 1) User Model Data Schema

Recommended storage: Supabase Postgres with jsonb for adaptive traits and explicit columns for high-frequency filters.

```sql
create table if not exists user_model (
  user_id text primary key,

  -- Rhythm and energy
  wake_time_target time default '06:30:00',
  sleep_time_target time,
  focus_window_morning_start time,
  focus_window_morning_end time,
  focus_window_evening_start time,
  focus_window_evening_end time,
  energy_dip_start time,
  energy_dip_end time,
  rhythm_type text, -- intensity_then_integration, etc.

  -- Food and body rules
  avoid_foods jsonb default '[]'::jsonb,
  preferred_proteins jsonb default '[]'::jsonb,
  morning_protocol jsonb default '[]'::jsonb, -- fruit/herbs/lemon/etc
  fasting_pattern text, -- intermittent_16_8, flexible_14_10
  meals_per_day_target int default 2,
  gut_regimen jsonb default '[]'::jsonb,

  -- Location cycle
  primary_locations jsonb default '[]'::jsonb,
  active_city text,
  location_cycle_days int,
  location_health_score jsonb default '{}'::jsonb,

  -- Personality and accountability
  accountability_style text, -- gentle_sensitive
  reminder_frequency text, -- one_nudge, standard
  tone_profile jsonb default '[]'::jsonb, -- advisor/strategist/mentor/griot
  derailers jsonb default '[]'::jsonb,

  -- Non-negotiables and goals
  non_negotiables jsonb default '[]'::jsonb,
  active_goals jsonb default '[]'::jsonb,

  -- Lunar + observance
  moon_cycle_mode text default 'build_integrate',
  weekly_rest_day text,
  lineage_observances jsonb default '[]'::jsonb,

  -- Adaptive weights and confidence
  model_confidence jsonb default '{}'::jsonb,
  last_refined_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists user_model_observations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  observed_at timestamptz default now(),
  source text not null, -- task_activity, checkin, wearable, meal_log, location
  category text not null, -- energy, food, gut, focus, derail, mood
  payload jsonb not null,
  derived_signals jsonb default '{}'::jsonb
);

create table if not exists user_model_updates (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  applied_at timestamptz default now(),
  field_name text not null,
  old_value jsonb,
  new_value jsonb,
  reason text,
  confidence numeric(5,2)
);
```

Behavior-driven update rules:
- Rhythm windows: recompute rolling 14-day median of high-output task completion and subjective energy >= 4/5.
- Energy dip: detect period with repeated low-output + low-energy check-ins.
- Food rules: strengthen avoid/preference weights when gut symptom score shifts within 6-18 hours of meals.
- Gut regimen effectiveness: track symptom delta from baseline using 7-day EWMA; retain items with positive sustained effect.
- Location effect: per-city energy, gut, and execution score; update location_health_score.
- Accountability style: if dismiss rate > 60 percent for repeated nudges, reduce nudge frequency and tone intensity.
- Non-negotiables adherence: mark complete/missed daily; use misses to trigger gentle evening recommit sequence.
- Goal salience: increase rank for goals with weekly progress, decay rank for stale goals with no touch in 10+ days.

## 2) Council Routing Engine

### 2.1 Council Registry

Store as structured config in code and in a database table for dynamic edits.

```sql
create table if not exists council_members (
  id text primary key,
  name text not null,
  domain text not null,
  subdomains jsonb default '[]'::jsonb,
  mentoring_style text not null,
  voice_markers jsonb default '[]'::jsonb,
  phase_affinity jsonb default '[]'::jsonb, -- build, integrate, new_moon, full_moon
  location_affinity jsonb default '[]'::jsonb,
  decision_affinity jsonb default '[]'::jsonb,
  active boolean default true
);
```

Core members and practical modern mapping:
- Ptahhotep: conduct, restraint, leadership composure
- Ibn Khaldun: cycle analysis, institutional momentum, social cohesion
- Ibn Rushd: legal-reason synthesis, jurisprudence framing
- Imhotep: systems durability, architecture quality
- Al-Khwarizmi: algorithmic decomposition, process rigor
- Ibn al-Haytham: evidence testing, methodological skepticism
- Ibn Sina: regimen-first health planning
- Al-Razi: empirical diagnosis and adjustment
- Maimonides: moderation and body-mind integration
- Ibn al-Nafis: challenge accepted assumptions
- Abiaka: local-grounded resilience, diplomacy under pressure
- Asi Yahola: continuity practices, fire-keeping discipline
- Peseshet: standards of care and training routines
- Harkhebi: practical celestial timing discipline
- Manetho: chronology, lineage record integrity
- Judah Halevi: spiritual-meaningful expression
- Ibn Gabirol: will, interior alignment, ethical ascent
- Ibn Daud: historical continuity argumentation
- Yehuda ibn Tibbon: translation and bridge-language clarity
- Al-Zahrawi: surgical precision in high-stakes execution

### 2.2 Routing Logic

Inputs:
- moon_phase_bucket: new_moon, waxing, full_moon, waning
- lunar_mode: build or integrate
- active_city
- day_type: build_day, admin_day, reflection_day, travel_day, recovery_day
- task_or_decision_type: legal, health, architecture, writing, strategy, scheduling, lineage
- user_state: energy_level, stress_level, gut_status, focus_status

Selection:
1. Candidate score per member = weighted sum of phase affinity, location affinity, decision affinity, and current user_state compatibility.
2. Filter inactive members and members below minimum score threshold.
3. Select top 1 primary + top 1 supporting member with domain diversity constraint.
4. If high-stakes legal or capital decision, hard-inject domain-specific primary (Ibn Rushd or Ibn Khaldun) then choose complement.
5. Persist routing event for feedback and future tuning.

Pseudo-logic:
```text
score = 0.35 phase + 0.25 decision + 0.20 location + 0.20 state_match
if task_type in hard_rules: force_primary(task_type)
support = best_non_overlapping_domain()
```

### 2.3 Voice Rendering in Advisor/Strategist/Mentor/Griot Tone

Response frame:
- Advisor: clear recommendation and why now
- Strategist: sequence and second-order consequence
- Mentor: one behavioral edge to strengthen
- Griot: brief lineage-honoring anchor sentence

Example style adapter output:
- Ptahhotep mode: concise, composed, boundary-protective
- Al-Khwarizmi mode: structured checklist and deterministic next step
- Abiaka mode: grounded, resilient, territory-aware action emphasis

## 3) Daily Planning Algorithm

Execution time: 06:00 local time (plus manual rerun).

Inputs:
- user_model
- prior-day completion and energy signals
- moon_phase + lunar_mode
- location + weather + transit context
- open goals and overdue priorities
- restaurant and meal history

Outputs:
- morning intention
- protected 4-hour work window
- movement/alignment activity by city
- gut-optimized meal plan with location-aware suggestions

Algorithm:
1. Determine day_type from calendar load + sleep quality + stress signal.
2. Score candidate work windows using rhythm windows and interruption risk.
3. Lock best 4-hour protected block; add one fallback block.
4. Generate intention as single sentence tied to top chokepoint and moon mode.
5. Movement selector:
- Medellin: neighborhood walk, incline route, mobility park loop
- Florida: park walk, mall circuit when heat index high, beach breathing walk
6. Meal planner:
- Enforce avoid rules: pork, US chicken, processed food, dairy
- Prefer fish, shrimp, quality steak, greens, herbs
- Morning fruit and herbs routine
- 1-2 meals later in fasting-compatible windows
7. Restaurant recommender:
- Query nearby options by dietary constraints
- Rank by historical favorite score + gut outcome score + travel friction
8. Store plan and send morning brief.

Tables:
```sql
create table if not exists daily_plan (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan_date date not null,
  city text,
  day_type text,
  moon_phase_bucket text,
  lunar_mode text,
  intention text,
  work_window jsonb,
  movement_plan jsonb,
  meal_plan jsonb,
  council_context jsonb,
  created_at timestamptz default now(),
  unique (user_id, plan_date)
);

create table if not exists restaurant_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  place_id text not null,
  city text,
  meal_type text,
  post_meal_gut_score int,
  energy_score int,
  favorite boolean default false,
  visited_at timestamptz default now()
);
```

## 4) Lunar-Cycle Engine (29.5-day)

Source of truth: astronomical moon phase API, cached daily.

State model:
- Day 0-14.75: Build mode (new commitments allowed, heavier execution)
- Day 14.75-29.5: Integrate mode (harvest, refine, consolidate, reduce new inputs)

Triggers:
- New moon trigger:
  - Guided-question intention ritual
  - Three prompts: what to begin, what to protect, what to decline
  - Writes to cycle_intentions table
- Full moon trigger:
  - Harvest and assess
  - Compare intended vs shipped; identify friction and one release decision

```sql
create table if not exists lunar_cycle_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  event_type text not null, -- new_moon, full_moon, phase_shift
  phase_bucket text not null,
  event_at timestamptz not null,
  ritual_payload jsonb default '{}'::jsonb,
  reflection_payload jsonb default '{}'::jsonb
);
```

## 5) Learning Loop (Gentle Accountability)

Loop cadence:
- Daily: micro-adjustments
- Weekly: pattern review
- Lunar: phase-level recalibration

Signals consumed:
- planned vs done tasks
- energy and gut check-ins
- reminder dismissal/accept/edit behavior
- meal outcomes
- location effects

Adaptation rules:
- If reminders are repeatedly dismissed, reduce frequency and change phrasing to supportive mode.
- If protected window repeatedly broken by external interruptions, propose boundary intervention script.
- If specific meal categories correlate with symptoms, down-rank and suggest alternatives.
- If evening deep work outperforms morning for 5+ days, temporarily split block into two weighted sessions.

Accountability style:
- One gentle nudge in morning and one evening reflection prompt.
- Language pattern: acknowledge load, name one concrete move, avoid shame framing.

## 6) Daily Briefing Format

### Morning Brief (presented once, editable)
- Today Intent: one line tied to top chokepoint and moon mode
- Protected Work Window: start-end + fallback slot
- Council Convened: primary and support member with one-line rationale
- Top 3 Moves: sequence with expected unblock
- Body Protocol: movement + alignment + gut regimen checklist
- Meal Plan: fasting-compatible plan and top 2 restaurant recommendations
- Boundary Guard: one sentence protecting time from likely derailers

### Evening Brief (reflective close)
- Shipped Today: concrete completed outputs
- What Energized You: quick signal capture
- What Derailed You: interruption or behavior pattern
- Gut and Recovery Notes: symptom and food response
- Model Update Preview: what will be tuned tomorrow
- One-Line Recommitment: gentle accountability statement

## Data Sources and Integrations

Moon phase:
- Option A: ipgeolocation astronomy API
- Option B: Stormglass astronomy endpoint
- Option C: local astronomy library fallback cache

Geolocation and city context:
- Browser geolocation API in Next.js client
- Reverse geocoding via Mapbox or Google Geocoding API
- Supabase profile city override for privacy and stability

Restaurant data:
- Google Places API, Yelp Fusion API, or Foursquare Places API
- Persist place_id and user feedback in Supabase tables

Stack implementation plan:
- Next.js:
  - Morning/evening briefing surfaces
  - city-aware movement and meal cards
  - ritual modals for new/full moon
- FastAPI:
  - scheduling endpoints and routing engine
  - council selection service
  - model update service and signal ingestion
- Supabase:
  - storage for user_model, observations, plans, council routing, feedback
  - row-level security by user_id
- Railway:
  - daily cron for plan generation and lunar triggers

## Operational Defaults for Current Profile

- Wake target: 06:30 local time
- Primary deep windows: mid-morning and late evening
- Afternoon dip reserved for movement, food, and low-cognition tasks
- Daily wins: clean eating, movement, meaningful work touch
- Accountability mode: gentle, sensitive, single-nudge
- Core derailer protection: interruption and unprotected time
- Dietary constraints enforced globally in planner
- Gut regimen tracked as top body priority
- Florida/Medellin location health differential actively monitored
