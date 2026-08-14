# Agent Execution Guide

This skill is meant to let an agent perform the product workflow directly from user-provided images or text.

## Image-First Flow

1. Inspect each uploaded image.
2. Extract visible text into these fields:
   - stem
   - options
   - user answer or markings
   - correct answer
   - explanation
   - subject cues
3. If multiple questions are visible, split them into separate mistake cards.
4. If text is too small or cropped, ask for one clearer crop or let the user manually fill the missing fields.
5. Continue with diagnosis even when only the stem and a manual knowledge tag are available.

## No-Question-Bank Mode

When no question bank exists, the agent must not claim "matched question".

Use this fallback:

- `matched_question_id`: empty
- `match_confidence`: low
- `knowledge_points`: user tags plus AI-suggested candidates
- `manual_required`: true when the knowledge point is not user-confirmed

This mode is still useful for the MVP because it supports manual knowledge labels, cause statistics, graph coloring, and study-log accumulation.

## Knowledge Graph Input

The graph can start as a simple Markdown outline or JSON file.

Minimum useful node fields:

```json
{
  "id": "civil.property.good-faith-acquisition",
  "name": "善意取得",
  "subject": "民法",
  "parents": ["civil.property.real-right-change"],
  "confusables": ["无权处分", "处分权"],
  "status": "normal"
}
```

If the user supplies a new mind map, require an XMind `.xmind` file for the mind-map workflow, then convert it into nodes and parent/confusable relations before diagnosing at scale. OPML, PDF, and images are not substitutes for the XMind input.
Base Obsidian Canvas exports should not include `color` fields; create a separate mistake-marked output when coloring is needed.

## User-Supplied XMind Maps

- Accept a user's own `.xmind` file through `SOURCE_XMIND` or the integration's `xmind_file` input.
- Validate that the file is an XMind archive before marking it, preserve the source, and write a separate marked copy.
- The bundled example currently covers 民诉; other subjects will be added in later updates.

## Session Memory

At the end of a work session, create a study-log delta:

- what the learner got wrong
- likely root causes
- graph nodes changed
- unresolved `???`
- next recommended practice
- what should be asked next time

## First-Run Obsidian Configuration

- Resolve the user's Obsidian Vault from the explicit request or host configuration; do not infer a fixed local path.
- If `REVIEW_VAULT/00-index/skill-config.json` is missing, initialize the core folders and ask for the weekly-review method before durable writing.
- On macOS, ask once whether the user wants `on_ingest`, optional `launchd`, or `manual`; persist the answer in `skill-config.json`.
- On other systems, use portable `on_ingest` by default and do not present the macOS-only `launchd` choice.
- Create subject map folders only when the subject is first used. Keep source `.xmind`, base maps, and marked maps in separate subdirectories.

## Weekly Review Trigger

- After confirmed ingestion or a retest update, use the configured trigger to refresh `02-weekly/YYYY-Www.md`.
- The portable event trigger refreshes the current and previous ISO week; a scheduled macOS trigger runs the same generator.
- Preserve manual notes outside the generated markers.
