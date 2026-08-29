@AGENTS.md

## Required issue-to-production workflow

For every product change, Claude must follow this workflow:

1. Link the change to an existing GitHub issue, or create a focused issue first.
2. Implement the complete acceptance criteria and run the relevant checks: `npm run lint`, `npm run typecheck`, `npm test`, and a web build when the UI changes.
3. Push the tested implementation to GitHub on a dedicated branch and merge it through the shared review flow.
4. Mark a GitHub issue as completed only after the code is pushed, any required Supabase deployment is live, and the feature has been verified.

Do not close an issue merely because work has started or because code only exists locally.
