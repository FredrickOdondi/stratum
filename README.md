# Stratum Advisory

**AI-powered strategy consulting platform.** Stratum takes a client engagement from intake to a polished deliverable, using specialised AI agents that attach citations to every claim.

**Live:** https://stratum-nine-orcin.vercel.app

## What it does

- **Engagement workflow:** staged pipeline from client intake through analysis, reviewer sign-off and final deliverable
- **Specialised agents:** strategy and data agents built on OpenAI, with retrieval over client documents via Pinecone
- **Business data connectors:** pulls metrics from storefront, payments and other business tools to compute KPIs like CAC, LTV and contribution margin (see [`connectors.md`](connectors.md))
- **Document ingestion:** parses uploaded PDFs, spreadsheets and CSVs
- **Deliverable export:** PDF, Word and PowerPoint output
- **Roles:** client dashboard, reviewer workspace and platform admin
- **Billing:** Paystack subscriptions

## Stack

React 19 · TypeScript · Vite · Supabase (auth, Postgres, migrations) · OpenAI · Pinecone · TanStack Query · Recharts · Vercel

## Project structure

```
src/
  pages/        auth, dashboard, engagement, reviewer, platform, public
  components/   connectors, engagement, layout, seo
  lib/          agents, dataAgent, search, pinecone, documentParser,
                generatePDF, docxExport, engagementStages, audit
supabase/
  migrations/   database schema
```

## Run locally

```bash
cp .env.example .env   # add your Supabase, OpenAI and Pinecone keys
npm install
npm run dev
```
