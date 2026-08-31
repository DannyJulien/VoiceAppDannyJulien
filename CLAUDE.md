# Delta team contract

This file is the shared project contract for people and coding agents. `AGENTS.md` points here so Codex and Claude follow the same rules.

## Product decisions

- **Product name:** Delta. The existing mobile/web label **Handled** remains until a dedicated rename issue changes it.
- **Base codebase:** Handled is the base; rebuild the useful Kern features on top instead of replacing the app wholesale.
- **Terminology:** call the brief-export variant that contains only added entries **new only**, never “delta mode”.
- **Hosting:** Supabase is the backend. The Expo web build deploys through Vercel; native development uses Expo.
- **Still to decide:** product core (brain versus assistant), AI-provider choice, and the multi-user instance model. Do not silently decide these in implementation work.

## Working agreement

1. Claim or create a focused GitHub issue before starting a change; do not let two people or agents work on the same scope unintentionally. Claiming is mandatory and immediate: the moment work on an issue starts, assign the issue to the person doing (or instructing) the work and add the "in progress" label. Never start implementation on an unclaimed issue.
2. Work on a dedicated branch, open a pull request, and let a teammate review/merge it. Do not directly push to `main`.
3. Keep migrations, deployment steps, and product decisions with the code in the same pull request. Announce any migration before it is applied to production.
4. Complete the acceptance criteria and run the relevant checks: `npm run lint`, `npm run typecheck`, `npm test`, and a web build when UI changes.
5. Push the tested implementation to GitHub. Mark an issue complete only after the code is merged, required Supabase/Vercel deployment is live, and the result is verified.

Do not close an issue merely because work has started or because code only exists locally.

## Local and secret handling

- Read the exact Expo v57 documentation at https://docs.expo.dev/versions/v57.0.0/ before changing Expo code.
- Put machine-specific infrastructure, tailnet details, and personal paths in the untracked `CLAUDE.local.md`; never commit it.
- Keep OpenAI and Supabase service-role keys in Supabase Edge Function secrets only. Client and Vercel builds use only the public Supabase URL and publishable key.
