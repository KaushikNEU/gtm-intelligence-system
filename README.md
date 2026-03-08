# GTM Intelligence System

> An AI-powered lead intelligence and activation platform built for GTM engineers.
> Contacts enter via webhook or CSV, get enriched with firmographic data, scored by an LLM agent, and routed into outbound, nurture, or suppression — all with full observability.

---

## 🔗 Live Demo

**[https://activate-tier-ai.emergent.host](https://activate-tier-ai.emergent.host)**

---

## 🎬 Demo Walkthrough

<!-- ============================================================
     REPLACE THIS SECTION:
     1. Record a 90-second Loom at loom.com (free)
     2. Walk through: seed data → process contact → view scoring → observability
     3. Copy the Loom share link and paste it below
     4. Replace the thumbnail URL with your actual Loom thumbnail
     ============================================================ -->

[![GTM Intelligence System Demo](https://cdn.loom.com/sessions/thumbnails/YOUR_LOOM_ID-with-play.gif)](https://www.loom.com/share/YOUR_LOOM_LINK_HERE)

> **What the video covers:**
> - Seeding demo contacts and running the full AI pipeline
> - LLM enrichment inferring company size, industry, and ICP signal
> - Lead scoring agent assigning tier A/B/C with reasoning
> - LLM Observability console showing latency and token usage per call

---

## 🏗️ Architecture

The system is built as a linear pipeline — each stage feeds the next:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Contact        │     │   Enrichment      │     │   LLM Scoring       │
│   Ingestion      │────▶│   Agent           │────▶│   Agent             │
│                  │     │                   │     │                     │
│ • Webhook POST   │     │ • Claude Sonnet   │     │ • Claude Sonnet     │
│ • CSV Upload     │     │ • Infers:         │     │ • Returns:          │
│ • Manual entry   │     │   - Company size  │     │   - Score (0-100)   │
│                  │     │   - Industry      │     │   - Tier (A/B/C)    │
│                  │     │   - Funding stage │     │   - Reasoning       │
│                  │     │   - ICP signal    │     │   - Fallback logic  │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                                                            │
                    ┌───────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│   Activation Layer                                                   │
│                                                                      │
│   Tier A (80-100) ──▶ Outbound sequence enrolled + AE Slack alert   │
│   Tier B (50-79)  ──▶ Nurture workflow                              │
│   Tier C (0-49)   ──▶ Suppressed + flagged for review               │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│   Observability Layer                                                │
│                                                                      │
│   Every LLM call logged: timestamp · model · tokens · latency · ✓/✗ │
│   Score distribution tracked over time                               │
│   Fallback rate monitored (enrichment failures → rule-based scoring) │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│   Warehouse Layer (Mocked → production-ready for Snowflake + dbt)   │
│                                                                      │
│   MongoDB mirrors dbt mart layer structure:                          │
│   raw_contacts → enriched_contacts → scored_contacts → funnel_marts │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 How the LLM Pipeline Works

### 1. Enrichment Agent
Takes a raw contact (email, name, company, domain) and calls **Claude Sonnet 4.5** with a structured prompt to infer firmographic data — company size, industry, funding stage, tech stack, and an ICP signal string. Returns a validated JSON object. If the LLM call fails or returns malformed output, the system falls back to a rule-based enrichment using available fields rather than dropping the contact.

### 2. Scoring Agent
Takes the enriched contact and runs it through a second Claude call with explicit ICP criteria in the prompt. Returns:
```json
{
  "score": 84,
  "tier": "A",
  "reasoning": "Series B fintech, 200+ employees, VP-level contact — strong ICP match"
}
```
Schema validation is enforced on every output. Malformed responses trigger the fallback scorer automatically.

### 3. LLM-as-a-Judge (Observability)
A spot-check layer that periodically runs a second LLM pass to evaluate whether the score reasoning actually matches the enrichment input. Flags inconsistencies for review. This pattern came directly from production work at Dox Health and Pace Wisdom Solutions.

### 4. Activation Routing
Score thresholds drive routing logic:

| Tier | Score Range | Action |
|------|------------|--------|
| 🟢 A | 80–100 | Outbound sequence + AE alert |
| 🟡 B | 50–79 | Nurture workflow |
| 🔴 C | 0–49 | Suppressed |

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + TypeScript | Fast, component-based UI |
| Backend | Python + FastAPI | Lightweight webhook receiver, async processing |
| LLM | Claude Sonnet 4.5 (Anthropic) | Best structured output reliability for scoring tasks |
| Database | MongoDB | Mirrors dbt mart layer structure — easy Snowflake migration |
| Auth | Google OAuth | Frictionless for GTM teams |
| Hosting | Emergent | Rapid prototype deployment |

---

## 📂 Project Structure

```
gtm-intelligence-system/
├── backend/
│   ├── routes/          # FastAPI webhook endpoints
│   ├── services/        # Enrichment, scoring, activation logic
│   ├── models/          # Pydantic schemas and DB models
│   └── utils/           # LLM call wrappers and observability logger
├── frontend/
│   ├── src/
│   │   ├── pages/       # Dashboard, Lead Intelligence, Scoring Engine, etc.
│   │   ├── components/  # Reusable UI components
│   │   └── api/         # Frontend API clients
├── tests/               # Backend test suite
├── design_guidelines.json
└── README.md
```

---

## 📊 Platform Pages

| Page | What it shows |
|------|--------------|
| **Dashboard** | Real-time stats, tier distribution chart, pipeline stage counts |
| **Lead Intelligence** | Contact table with search, filter, add, CSV upload, bulk process |
| **Contact Detail** | Full enrichment profile, score, tier, LLM reasoning per contact |
| **Scoring Engine** | Score distribution histogram, tier trends over time |
| **Funnel Analytics** | Stage-to-stage conversion rates, pipeline velocity |
| **Attribution** | Pipeline and revenue breakdown by acquisition source |
| **LLM Observability** | Every AI call: latency, tokens, model version, success rate |
| **Activation Log** | Full history of routing actions per contact |

---

## 🔌 Integrations

### HubSpot (Ready to connect)
The webhook endpoint is live at:
```
POST /api/webhook/hubspot
```
When HubSpot API credentials are configured, contacts auto-import and enter the pipeline on creation. Currently mocked with realistic dummy data.

### Snowflake + dbt (Production path)
MongoDB collections are structured to mirror dbt mart layers:
- `raw_contacts` → staging
- `enriched_contacts` → intermediate
- `scored_contacts` → mart

Migrating to Snowflake requires swapping the DB connector and pointing dbt at the Snowflake warehouse. No structural changes to the pipeline.

---

## 🚀 What I'd Build Next

- **Clay API integration** — replace LLM-inferred enrichment with real firmographic data from Clay for higher accuracy
- **Snowflake + dbt** — migrate MongoDB to a production warehouse with proper mart layers and funnel attribution models
- **Apollo/Instantly activation** — wire tier-A routing to real outbound sequences via API instead of mocked logging
- **Slack alerting** — real-time Slack webhook when a tier-A contact is scored
- **Prompt versioning** — track which prompt version generated each score so regressions are debuggable
- **Feedback loop** — feed AE disposition data (qualified/disqualified) back into prompt tuning

---

## 💡 Background

This system was built as a working prototype to demonstrate the GTM engineering architecture I described to the team at [Altruist / Hazel](https://hazel.ai) — specifically the intersection of LLM-powered automation, data enrichment pipelines, and revenue observability that the GTM Engineer role requires.

The architecture mirrors production patterns I've applied at Dox Health (LLM agentic pipelines, observability frameworks) and Krutin Outsourcing Partners (ETL pipelines, KPI dashboards for GTM leadership).

---

## 👤 Author

**Kaushik Jayaprakash**
MS Information Systems, Northeastern University (Aug 2026)
GTM AI Engineer Intern @ Dox Health

[LinkedIn](https://linkedin.com) · [Portfolio](https://portfolio.com) · [lnu.kau@northeastern.edu](mailto:lnu.kau@northeastern.edu)
