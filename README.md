# GTM Intelligence System 🚀

> An AI-powered lead intelligence and activation platform built for GTM engineers.
> Contacts enter via webhook or CSV, get enriched with firmographic data by Claude Sonnet, scored 0–100 with a tier and reasoning field, and routed into outbound, nurture, or suppression — all with full LLM observability.

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live%20Demo-activate--tier--ai.emergent.host-brightgreen?style=for-the-badge)](https://activate-tier-ai.emergent.host)
[![Built With](https://img.shields.io/badge/Built%20With-Claude%20Sonnet%204.5-blue?style=for-the-badge)](https://anthropic.com)
[![Stack](https://img.shields.io/badge/Stack-Python%20%7C%20FastAPI%20%7C%20React%20%7C%20MongoDB-orange?style=for-the-badge)](#tech-stack)

</div>

---

## 🔗 Live Demo

**[https://activate-tier-ai.emergent.host](https://activate-tier-ai.emergent.host)**

Sign in with Google → click **Seed Demo Data** on the Dashboard → navigate to Lead Intelligence → click **Process All Pending** to see the full AI pipeline in action.

---

## 🎬 Demo Videos

### 📹 Live Platform Walkthrough
[![GTM Intelligence System — Live Demo](https://img.shields.io/badge/▶%20Watch%20Live%20Demo-VEED-red?style=for-the-badge)](https://www.veed.io/view/3f8e8414-9d79-45e2-bc1c-97877b7d6339?source=editor&panel=share)

> **What this covers:**
> - Adding a new contact and running the full AI pipeline end-to-end
> - LLM enrichment inferring company size, industry, funding stage, and ICP signal
> - Scoring agent assigning tier A/B/C with a reasoning field
> - Scoring Engine, Funnel Analytics, Attribution, LLM Observability, and Activation Log walkthrough

---

### 🎙️ Architecture Explainer (NotebookLM Audio Overview)

<!-- ============================================================
     WHEN YOUR NOTEBOOKLM VIDEO IS READY:
     Option A — YouTube (recommended):
       1. Upload to YouTube (unlisted is fine)
       2. Replace YOUR_YOUTUBE_LINK with the video URL
       3. Replace YOUR_VIDEO_ID with just the ID from the URL
          e.g. for youtube.com/watch?v=abc123 → YOUR_VIDEO_ID = abc123

     Option B — VEED (same as above):
       Replace YOUR_YOUTUBE_LINK with your VEED share link
     ============================================================ -->

[![GTM Intelligence System — Architecture Explainer](https://img.shields.io/badge/▶%20Watch%20Architecture%20Explainer-NotebookLM-purple?style=for-the-badge)](YOUR_YOUTUBE_LINK)

> **What this covers:**
> - A two-host conversational breakdown of the full pipeline
> - How the enrichment agent, scoring agent, and LLM-as-a-judge work together
> - What each dashboard page shows and why it matters
> - Key technical concepts: schema validation, fallback logic, idempotency, warehouse design

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CONTACT INGESTION                             │
│   HubSpot Webhook  ──┐                                               │
│   CSV Upload       ──┼──▶  FastAPI Endpoint  ──▶  Processing Queue  │
│   Manual Entry     ──┘                                               │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        ENRICHMENT AGENT                              │
│                                                                      │
│   Claude Sonnet 4.5 infers from company name + domain:               │
│   • Company size    • Industry       • Funding stage                 │
│   • ICP signal      • Tech stack     • Enrichment confidence         │
│                                                                      │
│   ✓ Schema validated  │  ✗ Fallback → rule-based enrichment          │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         SCORING AGENT                                │
│                                                                      │
│   Claude Sonnet 4.5 returns structured output:                       │
│   { "score": 84, "tier": "A", "reasoning": "Series B fintech..." }  │
│                                                                      │
│   ✓ Schema validated  │  ✗ Fallback → weighted rule-based score      │
│   + LLM-as-a-Judge spot checks on reasoning quality                  │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       ACTIVATION ROUTING                             │
│                                                                      │
│   Tier A  (80–100) ──▶  Outbound sequence + AE Slack alert           │
│   Tier B  (50–79)  ──▶  Nurture workflow                             │
│   Tier C  (0–49)   ──▶  Suppressed + flagged for review              │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        OBSERVABILITY LAYER                           │
│                                                                      │
│   Every LLM call logged: timestamp · model · tokens · latency · ✓/✗ │
│   Score distribution tracked · Fallback rate monitored               │
│   LLM-as-a-Judge flags reasoning inconsistencies                     │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        WAREHOUSE LAYER                               │
│                                                                      │
│   MongoDB (dev)  ──▶  Snowflake + dbt (production path)              │
│   Mirrors dbt mart structure:                                        │
│   raw_contacts → enriched_contacts → scored_contacts → funnel_marts  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 How the LLM Pipeline Works

### Enrichment Agent
Takes a raw contact (email, name, company, domain) and calls **Claude Sonnet 4.5** with a structured prompt to infer firmographic data. Returns a validated JSON object:

```json
{
  "company_size": "201-500",
  "industry": "Fintech",
  "funding_stage": "series-b",
  "icp_signal": "Fast-growing fintech with strong engineering culture — high ICP match",
  "tech_stack_guess": ["Stripe", "Snowflake", "React"],
  "enrichment_confidence": "high"
}
```

If the LLM call fails or returns malformed output → **rule-based fallback** fills in available fields. No contact is ever silently dropped.

---

### Scoring Agent
Takes the enriched contact and runs a second Claude call with ICP criteria in the prompt. Returns:

```json
{
  "score": 84,
  "tier": "A",
  "reasoning": "Series B fintech, 200+ employees, VP-level contact — strong ICP match on all dimensions"
}
```

Schema validation enforced on every output. Invalid responses → **fallback scorer** using weighted field logic.

---

### LLM-as-a-Judge
A spot-check layer that periodically runs a third Claude pass — evaluating whether the score reasoning actually matches the enrichment input. Flags inconsistencies before they compound into systematic scoring drift.

---

### Activation Routing

| Tier | Score | Action |
|------|-------|--------|
| 🟢 A | 80–100 | Outbound sequence enrolled + AE Slack alert |
| 🟡 B | 50–79 | Added to nurture workflow |
| 🔴 C | 0–49 | Suppressed + flagged for periodic review |

---

## 📊 Platform Pages

| Page | What It Shows |
|------|--------------|
| **Dashboard** | Real-time tier distribution, pipeline stage counts, quick actions |
| **Lead Intelligence** | Contact table — search, filter, add, CSV upload, bulk process |
| **Contact Detail** | Full enrichment profile, score, tier, LLM reasoning per contact |
| **Scoring Engine** | Score histogram, tier trends over time, reasoning previews, drift detection |
| **Funnel Analytics** | Stage-to-stage conversion rates, pipeline velocity, drop-off analysis |
| **Attribution** | Pipeline breakdown by acquisition source and tier |
| **LLM Observability** | Every AI call: latency trend, token usage, error rate, fallback count |
| **Activation Log** | Full audit trail of all routing decisions with timestamp and reasoning |

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + TypeScript | Component-based, fast to iterate |
| Backend | Python + FastAPI | Lightweight async webhook receiver |
| LLM | Claude Sonnet 4.5 | Best structured output reliability for scoring |
| Database | MongoDB | Mirrors dbt mart structure — easy Snowflake migration |
| Auth | Google OAuth | Frictionless for GTM teams |
| Hosting | Emergent | Rapid prototype deployment |

---

## 📂 Project Structure

```
gtm-intelligence-system/
├── backend/
│   ├── routes/           # FastAPI webhook and contact endpoints
│   ├── services/         # Enrichment, scoring, activation logic
│   ├── models/           # Pydantic schemas and DB models
│   └── utils/            # LLM call wrappers and observability logger
├── frontend/
│   ├── src/
│   │   ├── pages/        # Dashboard, Lead Intelligence, Scoring Engine etc.
│   │   ├── components/   # Reusable UI components
│   │   └── api/          # Frontend API clients
├── tests/                # Backend test suite
├── design_guidelines.json
└── README.md
```

---

## 🔌 Production Integration Path

### HubSpot (Ready to connect)
Webhook endpoint is live at:
```
POST /api/webhook/hubspot
```
Configure in HubSpot: Settings → Integrations → Webhooks → point to the endpoint above. Contacts auto-import and enter the pipeline on creation.

### Snowflake + dbt
MongoDB collections mirror dbt mart layers exactly:

```
raw_contacts        →  staging model
enriched_contacts   →  intermediate model
scored_contacts     →  mart model
funnel_events       →  attribution mart
```

Migrating to Snowflake = swap the DB connector + point dbt at the Snowflake warehouse. No structural changes to the pipeline logic.

### Apollo / Instantly (Activation)
Tier A routing currently logs the activation action. In production, replace the logger call with an Apollo or Instantly API call to enroll the contact in a sequence directly.

---

## 🚀 What I'd Build Next

- **Clay API** — replace LLM-inferred enrichment with real firmographic data for higher accuracy
- **Snowflake + dbt** — migrate MongoDB to production warehouse with proper mart layers
- **Apollo/Instantly** — wire Tier A routing to real outbound sequences via API
- **Slack alerting** — real-time webhook when a Tier A contact is scored
- **Prompt versioning** — track which prompt version generated each score for regression debugging
- **Feedback loop** — feed AE disposition data back into prompt tuning every two weeks
- **Compliance guardrails** — flag LLM outputs that make regulated claims before activation

---

## 💡 Background

This system was designed to demonstrate the GTM engineering architecture at the intersection of LLM automation, data enrichment pipelines, and revenue observability — the core infrastructure a company like [Altruist / Hazel](https://hazel.ai) needs to scale commercial growth.

The architecture mirrors production patterns applied at:
- **Dox Health** — LLM agentic pipelines, prompt chain orchestration, observability frameworks
- **Pace Wisdom Solutions** — LLM-as-a-judge evaluation, data pipelines over 500K+ records
- **Krutin Outsourcing Partners** — ETL pipelines scaling 17x throughput, KPI dashboards for GTM leadership

---

## 👤 Author

**Kaushik Jayaprakash**
MS Information Systems, Northeastern University (Aug 2026)
GTM AI Engineer Intern @ Dox Health Inc, Boston

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?style=flat-square)](https://www.linkedin.com/in/kaushik-jayaprakash/)
[![Portfolio](https://img.shields.io/badge/Portfolio-Visit-green?style=flat-square)](https://kaushikjayaprakash.lovable.app/)
[![Email](https://img.shields.io/badge/Email-lnu.kau%40northeastern.edu-red?style=flat-square)](mailto:lnu.kau@northeastern.edu)
