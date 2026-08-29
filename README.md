# Handled

> Say it once. Consider it handled.

Handled is an Expo/React Native MVP for turning an explicitly recorded voice thought into a reviewed, useful action. The first release never sends an external message automatically: the user reviews every action before it is saved or executed.

## Current implementation

The working voice flow remains intact:

```text
VOICE OR TYPED TEXT → UNDERSTAND → CONFIDENCE GATE → FILED (undoable) or INBOX → USER APPROVES → TIMELINE
```

Research is an optional extension, never an automatic cost:

```text
VOICE → UNDERSTAND → “Add reliable information?” → RESEARCH → SOURCED RESULT
```

- Intent detection now recognizes notes, tasks, reminders, messages, questions, statements, and direct research requests. Every response is validated with Zod.
- Voice captures and typed notes use the same AI understanding flow. Handle proposes a category, matches or proposes a project, and suggests people.
- A confidence gate (`src/features/actions/filing-gate.ts`, thresholds 0.75 / 0.45 as in Kern) decides what happens next. A capture files itself only when the AI is confident **and** it is a plain note, task or reminder that names no unknown person or project. Anything involving a message, a recipient, a question from the AI, or an unresolved match waits in the Inbox. Below the low bar the AI's placement suggestions are dropped entirely. Auto-filed items are marked "filed for you" and can be sent back to the Inbox from the action screen. The per-user switch `profiles.auto_file_captures` (Inbox screen) turns automatic filing off.
- A user explicitly presses **Research** before the server calls OpenAI web search. The new Edge Function stores sources, findings, and their many-to-many citation links before a result is shown.
- Research results offer a concise answer, findings with source links, talking points, counterpoints, an editable share message, copy/Web Share fallback, a meeting briefing, and universal ICS download.
- Research, sources, findings, and meeting context are owner-scoped by RLS. The mobile/web client only receives the public Supabase URL and publishable key.
- `npm run build:web` exports a responsive static web build to `dist/`; `npm run serve:web` serves it locally with `/health`.

### Vercel web deployment

`vercel.json` deploys the exported Expo web app as a static site: it runs `npm run build:web` and publishes `dist/`. In Vercel, connect the `DannyJulien/VoiceAppDannyJulien` GitHub repository and set only these build-time variables for **Production**, **Preview**, and **Development**:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Never add `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or any other server secret to Vercel. Those remain in Supabase Edge Function secrets. After the Git connection is enabled, merges to `main` deploy production automatically and pull requests receive preview URLs.

### Required collaboration rule

Every contributor and coding agent must follow this issue-to-production workflow for any product change:

1. Link the change to an existing GitHub issue, or create a focused issue first.
2. Implement the complete acceptance criteria and run the relevant checks (`npm run lint`, `npm run typecheck`, `npm test`, and a web build when UI changes).
3. Push the tested implementation to GitHub on a dedicated branch and merge it through the shared review flow.
4. Only mark the GitHub issue as completed after the code is pushed, any required Supabase deployment is live, and the feature has been verified.

Do not close an issue merely because work has started or code exists only locally.

### Required Supabase deployment

The local implementation is complete, but the new database migration and Edge Function must be deployed to the existing Supabase project before users can press **Research**.

1. Immediately revoke the OpenAI key that was previously present in `.env.example`, then create a replacement in OpenAI.
2. Apply [20260823130000_research_and_meetings.sql](supabase/migrations/20260823130000_research_and_meetings.sql), [20260827090000_projects_categories_and_timeline.sql](supabase/migrations/20260827090000_projects_categories_and_timeline.sql), and [20260829090000_inbox_project_suggestions.sql](supabase/migrations/20260829090000_inbox_project_suggestions.sql) in order.
3. Configure these **Supabase Edge Function Secrets** (never Expo public variables):

   ```dotenv
   HANDLED_OPENAI_KEY=...
   OPENAI_ACTION_MODEL=gpt-4.1-mini
   OPENAI_RESEARCH_MODEL=gpt-5.4
   OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
   ```

4. Deploy both functions with the Supabase CLI, retaining the existing deployed function name `process-captur`:

   ```zsh
   supabase functions deploy process-captur --project-ref YOUR_PROJECT_REF
   supabase functions deploy research --project-ref YOUR_PROJECT_REF
   ```

   The `research` function imports its local source-policy modules, so CLI deployment is the supported route for it.

The research function uses the Responses API web-search source include, then rejects unlinked findings rather than presenting them as researched. See the official [Responses API reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).

### Mac mini and private phone access

See [deploy/mac-mini/README.md](deploy/mac-mini/README.md) for the production build, localhost-only server, health check, private Tailscale Serve HTTPS setup, and a macOS LaunchAgent example. The deployment does not add a service worker, so a user will not be stuck on an old cached build.

## Initial architecture notes (superseded)

This workspace was empty when development began. Phase 1 now provides a runnable Expo SDK 57 / TypeScript / Expo Router foundation, email/password authentication UI, Supabase client integration, a production-minded SQL migration, strict type checking, linting, formatting, and a first unit test. There is deliberately no mock API, seeded account, or fake voice processing.

Phase 2 now records only after an explicit microphone tap, displays a live elapsed time, and uploads the finished audio to the private Supabase bucket. A failed upload is persisted in the app document directory and its retry record is kept locally, so the user can retry instead of losing the recording. Transcription, AI interpretation, review, and timeline UI remain later product phases—not placeholders that claim to work today.

## Architecture

```text
Expo app (public Supabase URL + publishable key only)
  ├─ app routes / UI
  ├─ features/auth       validation, session state, auth commands
  ├─ services/supabase   one typed client and environment guard
  └─ TanStack Query      server-state boundary for later features

Supabase
  ├─ Auth                email/password identity
  ├─ Postgres + RLS      per-user data isolation
  └─ private Storage     raw audio under <user-id>/<capture-id>.<ext>

Future server-side edge functions (never the mobile app)
  ├─ services/ai         transcription + Responses API structured extraction
  ├─ services/context    people and prior-capture search
  └─ services/execution  approved local/external action executors
```

The mobile app only receives the Supabase project URL and publishable key. `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, and model configuration are reserved for an Edge Function or another server runtime. The current OpenAI transcription endpoint accepts common uploaded audio formats, while the Responses API is the planned server-side extraction boundary; see the official [GPT Transcribe model documentation](https://developers.openai.com/api/docs/models/gpt-transcribe) and [Responses API reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).

## Folder structure

```text
src/
  app/                  Expo Router routes and route groups
    (auth)/             sign-in and sign-up
    (app)/              authenticated experience
  components/           small reusable native UI primitives
  features/auth/        auth validation, commands, session provider
  providers/            root providers (Query + auth + safe area)
  services/supabase/    configuration and the only client instance
  types/                database contract and platform declarations
supabase/migrations/    schema, RLS, private storage bucket policies
tests/                  unit tests for pure business logic
```

As the MVP advances, `services/ai/`, `services/context/`, and `services/execution/` will be introduced behind narrow interfaces. `ContextProvider` will expose `searchPeople`, `searchPreviousNotes`, `searchDocuments`, `searchMessages`, and `searchCalendar`; only the first two will be implemented for the MVP. `ActionExecutor` will distinguish local reminder creation from approval-gated external actions such as email or Teams. No external executor will be enabled in V1.

## Database schema and security

The Phase 1 migration is [20260822130000_phase_1_foundation.sql](supabase/migrations/20260822130000_phase_1_foundation.sql).

| Table            | Purpose                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `profiles`       | User email, display name, preferred `en`/`nl`/`fr` language            |
| `voice_captures` | Private audio reference, transcript, processing state                  |
| `actions`        | Parsed note/task/reminder/message, status, schedule, draft, confidence |
| `people`         | User-scoped people/context records                                     |
| `action_people`  | Action-to-person relationship and role                                 |
| `notifications`  | Local reminder delivery state                                          |

All primary IDs are UUIDs. A trigger creates a profile from each email/password Auth signup. Every application table has RLS enabled and policies scoped to `auth.uid()`. The link table checks ownership of both its related action and person; notification rows also verify that any attached action belongs to the current user. The `voice-captures` bucket is private and allows access only inside the authenticated user’s own prefix. These policies follow Supabase’s recommended owner pattern using `TO authenticated` and `(select auth.uid()) = user_id`; see the [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Set up Phase 1

1. Create a Supabase project in the intended EU region, if applicable.
2. Apply the migration with the Supabase CLI (`supabase db push`) after linking the project, or run the migration in the Supabase SQL Editor.
3. In Supabase Auth, enable email/password and set your email confirmation policy. For local development, confirmation can be disabled; production should keep it enabled and configure the deep-link redirect URL.
4. Copy `.env.example` to `.env` and populate only:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
   ```

   Keep the service-role and OpenAI variables out of the Expo runtime. `.env` is ignored by Git.

5. Start the app:

   ```powershell
   npm run start
   ```

Until the two public Supabase variables are present, the authentication screen explicitly explains the missing configuration. It does not simulate a signed-in backend.

## Quality commands

```powershell
npm run lint
npm run typecheck
npm run test
npm run format
```

## Implementation plan

### Phase 1 — Foundation (implemented in this change)

1. Bootstrap Expo Router + strict TypeScript.
2. Define the design foundation and route groups.
3. Add the single Supabase client, guarded environment configuration, email/password signup/signin/signout, and Zod form validation.
4. Create the relational schema, Auth profile trigger, RLS policies, indexes, and private audio bucket policies.
5. Add baseline lint/type/test/format tooling and verify it.

### Next phases

1. **Voice capture:** implemented with `expo-audio` SDK 57. The app requests microphone permission only after an explicit tap, records to the persistent document directory, uploads with the authenticated user's private storage prefix, and offers a retry action for failed uploads. A new native build is required for the customized iOS permission text to take effect.
2. **AI:** call an Edge Function that transcribes audio and uses the Responses API with a Zod-validated structured action contract. Interpret dates in the device timezone and return clarification rather than guessing an ambiguous contact.
3. **Actions:** build review, confirmation/edit/discard, timeline, detail, completion, deletion, and local notifications.
4. **Context:** implement user-scoped people and previous-note search with PostgreSQL full-text search. Add embeddings/vector search only when retrieval quality demonstrates a need.
5. **Quality:** integration-test RLS and Edge Functions, add accessibility and offline retry coverage, make account deletion server-authorized, and conduct a security/privacy review.

## Privacy and retention

- Recording will only begin from an explicit user tap; background recording is out of scope.
- Audio storage is private and separated by authenticated user ID.
- Raw audio has no automatic deletion job yet. Phase 2 will add an opt-in retention setting plus a server-side job that safely deletes an object only after a successful transcript/action result is stored.
- Account deletion must be performed by an authenticated server endpoint using the Supabase Admin API; the mobile client will never receive that privilege.
- Choose the Supabase/OpenAI hosting and retention configuration appropriate to the target EU data-residency and GDPR obligations before production launch.

## Known technical risks

- A Supabase project and credentials have not been supplied, so the migration cannot be applied or exercised against a real Auth service from this workspace yet.
- Email confirmation needs production redirect/deep-link configuration in the Supabase dashboard.
- OpenAI processing must be implemented in a protected Edge Function with rate limiting, validation, timeouts, observability, and a retry-safe capture state machine; it must never run from the Expo client.
- Local notification behavior and reliable background scheduling vary by platform and must be tested on real iOS and Android devices in Phase 4.
- RLS needs integration tests against a disposable Supabase database before release, including cross-user denial cases and private storage isolation.
