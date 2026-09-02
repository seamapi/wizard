# Wizard eval

An offline harness that runs the wizard's integration agent against sample apps
and reports how each run went, so changes to the goal, model, block set, or
agent **harness** can be measured instead of eyeballed.

This is the control-vs-challenger setup: the `anthropic` harness (Claude Agent
SDK) is the control; a `pi` harness is the challenger (added later). The eval is
harness-agnostic — it runs whatever `SEAM_WIZARD_HARNESS` selects.

## What it does

For each fixture × mode (`full_api`, `customer_portal`):

1. Copy the fixture into a throwaway git repo (baseline commit).
2. Run the integration agent into it (`runIntegration`).
3. Capture the diff, cost, and elapsed time.
4. Apply deterministic **gates** (build-free): `.env` untouched, `seam`
   imported, no standalone Seam-only page.
5. Score the diff against the mode's rubric with an LLM judge.
6. Print an A/B-ready table.

## Running it

```sh
# Costs money and takes minutes — it makes real model calls.
SEAM_API_KEY=seam_… npm run eval

# A/B the challenger harness once it lands:
SEAM_API_KEY=seam_… SEAM_WIZARD_HARNESS=pi npm run eval
```

`SEAM_API_KEY` is a dev key; it is exchanged for a short-lived inference token
(the Anthropic key never leaves the Seam proxy). The eval prints its temporary
log-file path before starting and mirrors all progress there. Nothing here runs
in normal CI — it is a manual/opt-in harness.

## Fixtures

Small sample apps under `eval/fixtures/<name>/`, each with a `fixture.json`
(`sdk`, `framework`) declaring what the wizard would otherwise detect. Add a
framework by dropping in a new directory.
