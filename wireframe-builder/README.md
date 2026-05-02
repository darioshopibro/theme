# Shopify Wireframe Builder

A local AI-assisted tool for turning Shopify theme demos into editable wireframes and reusable section patterns.

The project was built as part of a Shopify Theme Store research workflow: scrape real theme demos, extract sections, analyze their structure with Claude Code skills, and rebuild them as editable wireframe blocks that can be ported across theme concepts.

## What It Does

- Extracts sections from Shopify demo storefronts with Puppeteer.
- Stores extracted section HTML in `extracted/` for visual comparison.
- Imports sections into a React canvas for layout, resizing, grouping, and theme-setting experiments.
- Converts extracted sections into structured wireframe blocks through a Claude Code skill workflow.
- Connects to a Shopify store locally to preview and push template/theme changes during development.

## Agent Workflow

The repo includes Claude Code project context and reusable skills:

- `CLAUDE.md` defines the shared-engine Shopify theme workflow and section-porting rules.
- `.claude/skills/analyze-section/` turns queued imported sections into structured wireframe data.
- `.claude/skills/port-section/` documents and adapts finished sections for another theme concept.

The important part of the project is not just the UI. The system is designed so the agent can repeatedly inspect real extracted markup, produce consistent wireframe settings, and document portability decisions instead of relying on one-off prompts.

## Tech Stack

- React + TypeScript + Vite
- Express local API
- Puppeteer for storefront extraction
- Shopify Admin API integration
- Claude Code skills for repeatable section analysis

## Local Setup

Requires Node `20.19+` or `22.12+`.

```bash
npm install
npm run dev
```

The client runs on `http://localhost:3006` and the local API runs on `http://localhost:3007`.

Optional Shopify connection values:

```bash
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxx
SHOPIFY_STOREFRONT_PASSWORD=optional_password
```

## Security Notes

This is a local development tool, not a hosted multi-user SaaS app.

- `.env`, generated app state, queue files, and build output are ignored.
- Shopify tokens are stored only in the local `.env` file during development.
- The local API uses permissive CORS and file writes for speed, so it should not be deployed publicly without authentication, token encryption, scoped CORS, request validation, and a proper secret store.

## Verification

```bash
npm run build
```

Linting is enabled, but the current prototype still has cleanup work around strict `any` usage and React compiler lint rules. The production build is the main verification target for the current state of the demo.
