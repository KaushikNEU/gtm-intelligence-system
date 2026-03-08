# GTM Intelligence Platform - PRD

## Original Problem Statement
Build an end-to-end GTM intelligence platform for sales and marketing teams. Core entities: contacts, companies, enrichment profiles, lead scores, tiers, sequences, pipeline stages, funnel events, LLM call logs, and observability metrics.

## User Personas
- **Sales Teams**: Import contacts, view scores, prioritize outreach
- **Marketing Teams**: Analyze funnel conversions, track attribution
- **Revenue Operations**: Monitor pipeline health, LLM performance

## Core Requirements (Static)
1. Contact management with enrichment and scoring
2. LLM-powered firmographic enrichment (Claude Sonnet 4.5)
3. Structured lead scoring with tier classification (A/B/C)
4. Automated routing (Tier A → outbound, B → nurture, C → suppress)
5. LLM observability with call logging
6. Funnel analytics and pipeline attribution
7. Weekly health summaries

## What's Been Implemented (Jan 2026)

### Backend (FastAPI + MongoDB)
- **Auth**: Emergent Google OAuth with session management
- **Contacts**: Full CRUD, bulk upload (CSV), detail view
- **LLM Services**:
  - Enrichment (Claude Sonnet 4.5) - firmographic inference
  - Scoring (Claude Sonnet 4.5) - tier classification with reasoning
  - Email personalization (GPT-4o) - first-line variants
  - Judge check - score quality validation
  - Guardrail check - compliance validation
- **Analytics**: Dashboard, funnel, scoring, attribution, LLM observability
- **Processing**: Single contact and bulk processing pipelines
- **Webhook**: HubSpot receiver (mocked for demo)

### Frontend (React + Tailwind + Shadcn)
- **Landing Page**: Marketing hero with Google OAuth
- **Dashboard**: Real-time metrics, tier distribution, pipeline stages
- **Lead Intelligence**: Contact table with search/filter, bulk actions
- **Contact Detail**: Full profile with enrichment, LLM logs, activations
- **Scoring Engine**: Score distribution, tier trends, reasoning preview
- **Funnel Analytics**: Pipeline funnel visualization, conversion rates
- **Pipeline Attribution**: Revenue by source/tier
- **LLM Observability**: Call logs, latency trends, token usage
- **Activation Log**: Routing history by action type
- **Settings**: Profile, weekly summary, data export

### Integrations
- **Emergent LLM Key**: Claude Sonnet 4.5 + GPT-4o
- **Emergent Google Auth**: Social login
- **MongoDB**: Data warehouse (mocked Snowflake)
- **HubSpot Webhook**: Contact ingestion (mocked)

## Prioritized Backlog

### P0 - Critical (Blocking)
- [x] Core contact pipeline (enrich → score → activate)
- [x] Authentication flow
- [x] Dashboard with real-time data
- [x] LLM observability

### P1 - High Priority
- [x] Bulk processing
- [x] Contact detail view
- [x] Weekly health summary
- [x] Guardrail checks
- [x] Data export
- [ ] Pipeline stage drag-drop updates
- [ ] Email sequence integration

### P2 - Medium Priority
- [ ] HubSpot live integration
- [ ] Snowflake/dbt migration
- [ ] Custom scoring rules
- [ ] Team collaboration
- [ ] Notifications/alerts

### P3 - Nice to Have
- [ ] Mobile responsive optimization
- [ ] Dark/light theme toggle
- [ ] API rate limiting
- [ ] Audit logs

## Next Tasks
1. Implement pipeline stage drag-drop in Lead Intelligence
2. Add email sequence builder for outbound campaigns
3. Connect live HubSpot API when credentials available
4. Add background job processing for bulk operations
5. Implement real-time WebSocket updates

## Technical Notes
- LLM enrichment takes 3-8 seconds per contact
- Bulk processing limited to 50 contacts per batch
- MongoDB used as Snowflake mock - schema mirrors dbt mart layers
- Auth sessions expire after 7 days
