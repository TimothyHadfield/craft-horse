# Horse Perfection: progress

## START HERE
Last updated 2026-10-16. Read `CLAUDE.md` first (file map, traps), then this file.

## Goal right now
Keep the published calculator working. No feature work is planned.

## Status
| Area | State |
|---|---|
| Live site | Working again after 2026-10-16 fix (was blank: unpinned Babel 8) |
| Calculator, stable, breeding, backup | Working (checked with phone-view 2026-10-16) |
| Tests | None (single-file app; verified with phone-view) |

## Authorized next steps
None.

## Standing instructions
- None recorded from Tim for this project yet. Global rules in `~/.claude/CLAUDE.md` apply.

## Traps
See `CLAUDE.md` > Traps (pinned CDN versions, double-quoted font-family, sync refs, Monte Carlo breeding numbers).

## Decisions
- 2026-10-16 sweep: pinned React 18.3.1 (production builds) and Babel standalone 7.29.9; fixed
  input boxes going stale after re-typing the same value; import rejects entries without numeric
  stats; added aria-labels, meta description and an empty favicon. No visual change (calc screen
  pixel-identical before/after).

## NOT verified
- On Tim's real iPhone (only Safari-engine simulation via phone-view).

## Rejected / parked
- Parked: precompiling the JSX (removes in-browser Babel, the main cause of the ~9 s first paint on
  mobile Lighthouse). Needs a build step; Tim's call.
