# RQST — IMPROVEMENT.md

- Observations record symptom + suspected root cause; only causes are
  diffable.
- Graduation: mistake-corrections at 1 occurrence; structural changes
  at 2+; prune ruthlessly as the counterweight — if the behavior
  happens without a line, cut the line.
- Diffs: exact remove, exact add, a one-sentence reason from a real
  session, and one line naming the working behavior the diff must not
  break.
- Rejected or reversed diffs are logged with reasons, never silently
  dropped.
- Delivery: context and reference files change as complete replacement
  files or direct git edits, never pasted fragments.
- Pay for additions: CLAUDE.md stays constant-size; growth goes to
  reference files with "read when" pointers.
- Write access: Claude may edit CLAUDE.md and reference files directly
  on feature branches; every such edit gets a changelog entry and lands
  only via PR reviewed by David (and shaun24 once onboarded to the
  kit).
