# Shopify Theme Store — Plan

## What we're building
Two Shopify themes for the official Theme Store. Two devs (me and a partner). Multiple themes built in parallel.

## Structure: Shared Engine
- One base (engine) — shared variables, base sections, snippets
- Each theme is a layer on top of the engine with its own niche and visuals
- When a dev finishes a section → Claude IMMEDIATELY:
  1. Builds a version of that section for the other theme (swap tokens, adapt to niche)
  2. Writes an MD with the differences (format below)
- Claude advises which sections each dev should take

### Section MD format (auto-generated for every finished section)
```
# [Section name]
- **Origin theme:** A or B
- **What it does:** (one sentence)
- **Port status:** green / yellow / red
- **Same in both themes:** (what doesn't change)
- **Different:** (which tokens, blocks, layout change)
- **If yellow/red:** what specifically needs to change and why
```
This runs automatically via the `/port-section` skill.

## Engine variables (lock down BEFORE coding)
- max-width, spacing, grid, breakpoints — defined once in the engine
- Think through which engine elements MAY need to differ between themes
- These variables are how the same sections adapt across both themes
- **THIS IS THE CRITICAL TODO** — when we reach this step, Claude must interrogate me in detail about every variable

## Section portability
- Some sections port cleanly between themes, some don't
- The plan must include a list: portable / non-portable / needs-modification
- The non-portable list DEPENDS ON THE NICHES — picking similar niches that target two adjacent SEO keywords drastically shrinks it
- **That's why we pick CLOSELY RELATED niches** — more sections port, less duplicate work

## Coding workflow
- Plan ALL sections, design, and features for both themes BEFORE any code
- One dev starts from item #1, the other from the last item — build toward the middle
- Every finished section is evaluated for transfer to the other theme

## Research phase — what we need
- Scrape with launch DATES — so we know reviews/month, not just totals
- Sections from the top themes — a scraper that pulls every section from the demos
- Upgrade JSON with each theme's sections (for inspiration and comparison)
- A research agent (or part of one) that researches themes, reads transcripts, analyzes

## Claude Code setup
- Build/install design and development skills
- A research agent that can research themes and run scripts
- Claude advises on section priority, portability, workflow
