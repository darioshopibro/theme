# Shopify Theme Research

Working repo for a two-theme Shopify Theme Store project. Two parts:

- **[`wireframe-builder/`](wireframe-builder/)** — a visual section editor with live preview against a real Shopify dev store. React + Vite client, Express + Puppeteer server, Admin API push. See its README for architecture and setup.
- **`scrape-full.js`** + `themes_full_*.json` — Puppeteer scrapers that pull section structures from public Theme Store demos so we can compare layouts across top themes.

Built with Claude Code under direction. Custom skills live in [`.claude/skills/`](.claude/skills/) and [`wireframe-builder/.claude/skills/`](wireframe-builder/.claude/skills/) and encode the section-analysis and section-porting rules so the agent stays consistent across sessions.

## Layout

```
.
├── CLAUDE.md                       project rules
├── wireframe-builder/              the app — see its README
├── .claude/skills/analyze-section/ custom skill: queued section analysis
├── scrape-full.js                  theme demo scraper
├── themes_full_*.json              scraped theme data
└── shopify-theme-settings-report.md  notes on settings schema patterns
```

## Setup

Each part runs independently. For the wireframe builder, see [`wireframe-builder/README.md`](wireframe-builder/README.md).

## Status

Wireframe builder: working prototype against a connected dev store. Theme research: ongoing — picking the two niches and the engine variables before coding the actual themes.
