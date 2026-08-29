# Kern → Handled integration analysis

Analysis only. Written 2026-08-29 against Handled at `d38d9f9` (branch `feature/daniel`) and Kern at `21efe88` (`C:\Users\Daniel\projects\kern`). Every claim below was checked against code; where a README or PRD says something the code does not do, that is called out with the file. No source was modified.

Notation: `H:` = Handled path, `K:` = Kern path. Effort is S/M/L **in Handled's stack** (Expo SDK 57 / Supabase / Edge Functions), including the migration and the RN screen work, not just the logic.

---

## The five most important findings

1. **The two apps disagree on *when* the user reviews, and the disagreement is structural, not cosmetic.** Handled persists nothing until the user presses "Save to Inbox" on `H:src/app/(app)/review.tsx`; the AI output lives only in AsyncStorage (`H:src/features/actions/action-review-provider.tsx:14,65`) and every saved action is written with `status: 'approved'` (`H:src/features/actions/action-service.ts:47`). Kern persists the capture immediately (202, `K:backend/app/main.py:190-215`), auto-files anything with confidence ≥ 0.75 (`K:backend/app/config.py:36-37`, `main.py:113`) and only routes the 0.45–0.75 band to a review queue; "review" there is *correction after the fact* with undo (`K:frontend/src/ActivityRow.jsx:13-25`). Porting the confidence gate (issue #7) is therefore not a feature add — it changes Handled's stated product rule "the user reviews every action before it is saved" (`H:README.md:5`). The owners have to pick one model or define a hybrid explicitly (see Decision 1).

2. **The two apps disagree on *what the model may change*.** Kern's classifier prompt has hard rules: same language in/out, first person preserved, zero information loss, restructure into constrained markdown (`K:backend/app/classifier.py:96-101`). Handled's instruction is one sentence — "Turn one voice capture into one useful action or useful context" (`H:supabase/functions/process-capture/index.ts:272`) — with no language, perspective or completeness rule, and a 2 000-char `summary` (`index.ts:86`). Handled's UI then *re-splits* the summary into ≤4 "key points" by sentence boundary (`H:src/app/(app)/review.tsx:28-34`, `H:src/app/(app)/action/[id].tsx:36-42`), which would mangle Kern-style markdown bodies. Porting the prompt rules (issue #6) forces a decision on the body format and on those two screens.

3. **Handled's type system has three overlapping axes (action_type, intent, category) and Kern has two (type, project link); they do not map 1:1.** Handled stores `action_type` ∈ {note, task, reminder, message} (`H:supabase/migrations/20260822130000_phase_1_foundation.sql:10`), collapses the AI intents question/statement/research_request back to `note` on save (`H:src/features/actions/action-schema.ts:60-63`), and adds a user-picked `category` ∈ {inbox, work, personal, meeting, idea} (`H:…/20260827090000_projects_categories_and_timeline.sql:6`). Kern's `type` ∈ {todo, idea, knowledge} after deliberately retiring `note` (`K:pocketbase/pb_migrations/1751920000_retire_note_type.js`). `idea` exists in Handled as a *category* and in Kern as a *nature* — the same word for different things. The merged schema needs one decision about which axis carries "nature" (Decision 2).

4. **Handled's projects are colour labels; Kern's projects are threads the AI knows about.** Handled `projects` = `name, color` (`…projects_categories_and_timeline.sql:8-15`); the Edge Function never sees the project list (`process-capture/index.ts:266-283` sends only the transcript). Kern `projects` = `title, summary, status, tags`; the classifier receives the live titles as a hard enum (`K:backend/app/classifier.py:149-160`), can create a project on high confidence (`K:backend/app/main.py:123-133`), resolves fuzzy matches server-side (`main.py:67-83`), and escalates doubtful matches to a second model (`classifier.py:187-198`). Issue #8 ("projects as threads + addition-to-existing") therefore touches the migration, the Edge Function contract and the review UI at once — it is the largest single port.

5. **Several things Handled's README describes are not in the code, and some Kern things only exist because PocketBase has no auth.** Handled: the `notifications` table is never read or written by any client code (grep of `src/` finds no reference outside `types/database.ts`); the `pending` action status is never written; AI-extracted `people` are shown on the review screen (`review.tsx:104`) but never persisted (`saveReviewedAction`, `action-service.ts:27-58`, inserts no `action_people` row); `ContextProvider.searchPeople/searchPreviousNotes` (`README.md:101`) is an interface with no implementation (`H:src/features/context/context-relevance-service.ts` is 17 lines of types). Kern: all collection rules are open strings (`K:pocketbase/pb_migrations/1751700000_init_kern_schema.js:12-16`), the PWA writes directly to PocketBase (`K:frontend/src/api.js:42-64`), and "Undo" deletes the raw capture from the browser (`K:frontend/src/Capture.jsx:241`). None of that survives a port; every Kern write path becomes either an RLS-guarded client insert or an Edge Function.

---

## 1. Feature inventory

Verdict values: **Handled already has it** · **port from Kern** · **port with changes** · **conflicts — decision needed** · **drop**.

| # | Feature | Kern | Handled | Verdict | Effort | Notes |
|---|---|---|---|---|---|---|
| 1 | Email/password auth, per-user data isolation | None. Single user, open API rules (`pb_migrations/1751700000_init_kern_schema.js:12-16`); PWA talks to PocketBase unauthenticated (`frontend/src/api.js:7`). Hardening deferred (`CLAUDE.md:147-151`). | Supabase Auth + RLS on every table (`20260822130000_phase_1_foundation.sql:151-330`), profile trigger (`:128-146`), private storage prefix (`:346-376`). | Handled already has it | – | Nothing to port. Every Kern write path must be re-expressed under RLS. |
| 2 | Voice recording (explicit tap, elapsed time) | MediaRecorder in the browser, mp4/webm (`frontend/src/Capture.jsx:16-21,79-132`); browser SpeechRecognition as live preview (`:103-125`). | `expo-audio` `useAudioRecorder` (`src/features/captures/use-voice-capture.ts:39-40,67-85`); m4a native, webm on web (`capture-utils.ts:8-22`). | Handled already has it | – | Handled has no live transcript preview while recording. Kern's preview is a browser-only API (Web Speech); on RN it would need a third-party module. Listed as a separate row (#3) because it is not "the same feature". |
| 3 | Live "rough" transcript while recording | Yes, Web Speech API, display only (`Capture.jsx:103-125,263-271`). | No. Shows "Voice is being captured…" copy (`home.tsx:120-127`). | drop | – | Not available via any Expo SDK 57 module; a native SpeechRecognition dependency is not justified for a preview the server transcript overrides anyway. |
| 4 | Typed capture (pencil) | Textarea in the same overlay; goes through the *same* ingest+classifier as voice (`Capture.jsx:224-230`, `api.js:25`). Cmd/Ctrl+J shortcut (`App.jsx:58-71`). | "Write a note" screen: title + details + category + project + person, saved directly as `note` with **no AI** (`src/app/(app)/note/new.tsx`, `action-service.ts:60-94`). | conflicts — decision needed | M | Kern: text is a capture, AI files it. Handled: text is a form, user files it. Kern's PRD principle 1 ("manual forms correct, never create", `docs/prd.md:37-39`) is directly contradicted by Handled's note form. Decision 9. |
| 5 | URL entry points (`?rec=1` Action Button, `?text=` share target) | `App.jsx:41-53`, `vite.config.js:32-37` (Android share_target). | None. `scheme: handled` in `app.json:10` but no route reads params for capture. | port with changes | S | Expo Router deep link `handled://home?rec=1` is straightforward; share-target on web needs a `share_target` entry added by hand to the existing `public/manifest.json`. iOS Action Button = Shortcut opening the URL. |
| 6 | Offline capture outbox | Text outbox in localStorage, flushed on load + every 30 s (`api.js:70-101`, `App.jsx:100-110`). | Audio outbox in AsyncStorage with manual "Retry upload" (`capture-service.ts:19-124`, `home.tsx:164-177`). | Handled already has it (partially) | S | Handled queues *audio*, Kern queues *text*. Handled has no auto-flush and no typed-capture outbox. Issue #13 = add auto-retry on reconnect + cover typed captures. |
| 7 | Dedup of repeated captures | sha256 of `source:external_id` or normalised text, unique index (`main.py:57-64`, `init_kern_schema.js:43`); errored duplicates get retried (`main.py:202-211`). | None. Every stop creates a new `voice_captures` row (`capture-service.ts:42-49`). | port with changes | S | Audio bytes cannot be text-hashed before transcription. Dedup on transcript after transcription (Edge Function side) or on `external_id` only. Low value until a second ingest source (Plaud) exists. |
| 8 | Idempotent processing / retry | Background task checks for an existing entry before creating one (`main.py:170-173`). | `retryProcessing` re-invokes the function (`use-voice-capture.ts:131-141`); the function re-downloads and **re-transcribes** every time — no check for an existing transcript (`process-capture/index.ts:230-263`). | port from Kern | S | Add "if `voice_captures.transcript` is set, skip transcription" to the Edge Function. Pays for itself in OpenAI cost on every retry. |
| 9 | Transcription | Deepgram nova-3, `language=multi`, `smart_format` (`main.py:218-248`, `config.py:21-23`). Browser words as fallback. | OpenAI `gpt-4o-mini-transcribe`, no language hint (`process-capture/index.ts:247-256`). WebM sniffed by magic bytes (`:177-188`). | conflicts — decision needed | S–M | Both are one HTTP call from a server. The real question is quality on mixed NL/EN and cost. Decision 4. |
| 10 | Async ingestion (202 + background) | Yes (`main.py:190-215`); PWA polls capture status (`Capture.jsx:23-36`). | Synchronous: one Edge Function call does download → transcribe → intent and the client awaits it (`use-voice-capture.ts:87-108`); commit `a0be1f1` raised the client timeout. | conflicts — decision needed | M | Async on Supabase means: client marks capture `uploaded`, a DB webhook or `pg_net`/queue triggers processing, client subscribes (Realtime) or polls. Needed for Plaud webhooks and for Kern-style auto-filing; not needed for Handled's current review-first flow. Decision 5. |
| 11 | Intent / classification | 5 outcomes todo/project/idea/knowledge/addition → entry type todo/idea/knowledge (`classifier.py:34-84`). Haiku 4.5 structured output; Sonnet escalation for doubted additions (`:183-199`); confidence gate (`main.py:95-164`). Stub classifier without a key (`:209-230`). | 7 intents note/task/reminder/message/question/statement/research_request (`process-capture/index.ts:31-33`); extracts people, scheduledAt, messageDraft, research hints, clarification question; gpt-4.1-mini Responses API strict json_schema (`:266-283`). | conflicts — decision needed | L | Issue #6. Kern's rewrite rules and project-enum trick port as prompt/schema changes in the same Edge Function. Kern's outcome set and Handled's intent set are not supersets of each other (Kern has no reminder/message/research; Handled has no project/addition/priority/tags). Decisions 1, 2, 3. |
| 12 | Confidence gate / auto-file | ≥0.75 filed, 0.45–0.75 review, <0.45 raw transcript kept as body, model title only (`main.py:101-111`). | `confidence` stored (`actions.confidence`) but never used for routing; `requiresClarification` drives a warning box only (`review.tsx:173-180`). | conflicts — decision needed | M | Issue #7. Requires Decision 1 first. Handled's `status = 'pending'` enum value already exists and is never written — a natural home for "needs review" without a new column. |
| 13 | Rewrite quality rules (language, first person, no info loss, constrained markdown) | `classifier.py:96-113`; rendered by a 36-line markdown-subset renderer (`frontend/src/md.jsx`). | No rules. UI splits `summary` by sentence into bullets (`review.tsx:28-34`, `action/[id].tsx:36-42`). | port with changes | M | Prompt port is S; the body-format change (markdown in `summary`, a `MdBody` RN component, dropping `summaryPoints`) is the M. Decision 3. |
| 14 | Review queue UI (type chips, confidence bar, original transcript, approve/reject/edit) | Boxed review card: type chips pre-pick a correction, conf bar, `<details>` transcript, Approve/Reject/Edit, "Create project & link" (`EntryCard.jsx:223-271`). | Review screen before save: type pill (read-only), summary points, WHEN/PEOPLE tiles, edit form, category + project pickers, research offer (`review.tsx:146-397`). Transcript shown only on the detail screen after save (`action/[id].tsx:331-336`). | port with changes | M | Handled's review screen already exists; port the *one-tap type correction* and *show transcript at review time*. Whether this screen stays pre-save (Handled) or becomes the inbox queue (Kern) is Decision 1. |
| 15 | "Filed" result screen with refile chips + undo | After classifying: card, "Heard:" line, wrong-type chips, Done/New/Undo (`Capture.jsx:296-334`). Undo deletes entry **and raw capture** (`:239-245`). | After review + save: navigates to inbox (`review.tsx:80-87`). No undo; delete is on the detail screen with a confirm step (`action/[id].tsx:499-515`). | port with changes | M | Only meaningful if auto-file exists (Decision 1). Under RLS, "undo" = client deletes its own `actions` + `voice_captures` rows (both allowed by policy). Raw-capture deletion should be a deliberate choice, not a side effect. |
| 16 | Entry nature: todo / idea / knowledge | Locked after usage (`prd.md:92-94`, migration `1751920000`). | note/task/reminder/message + category. | conflicts — decision needed | M | Issue #9. See §2 mapping table and Decision 2. |
| 17 | Priority flag (binary) | `priority ∈ {high}` or empty (`1751930000_binary_priority.js`); model sets it only on explicit urgency words (`classifier.py:64`); flag icon in title (`EntryCard.jsx:187-197`, `styles.css:397-400`). | None. | port from Kern | S | One boolean column + prompt field + icon. Kern's "binary, never inferred" rule is a product decision (commit `a681bf4`, `7c6ffcb`). |
| 18 | Due date (date only) + overdue/bucket logic | `due` date, extracted only when explicit (`classifier.py:66-72`); bucket logic overdue/today/tomorrow/week/later in calendar days (`utils.js:25-38`); red overdue badge. | `scheduled_at` timestamptz + `scheduled_timezone` (`phase_1:45-46`); free-text input "2026-08-23 16:30" (`review.tsx:207-216`); formatted with time (`action-utils.ts:7-17`). No overdue concept. | port with changes | S–M | Two different notions: Kern = deadline day; Handled = moment (for reminders/meetings). Recommend keeping `scheduled_at` and adding `due_date date`. `dueBucket` is pure TS — trivially portable and unit-testable. |
| 19 | Tags | `tags` json, 1–4 lowercase, model-generated (`classifier.py:73`); searchable in Library (`App.jsx:340-344`); not shown on cards. | None. | port from Kern | S | `text[]` column + prompt field. Low visible value today; only Library search uses it. Could be dropped without loss. |
| 20 | Status open/done, checkbox, done collapsed | `status ∈ {open, done}` (`init_kern_schema.js:98-103`); checkbox on todo rows (`EntryCard.jsx:292-301`); "Done (n)" collapsed (`App.jsx:322-327`). | `status ∈ {pending, approved, completed, cancelled}`; "Mark completed" button on detail (`action/[id].tsx:491-497`); no list-level toggle. | Handled already has it (data), port from Kern (UI) | S | `completed` ≡ done. Inline checkbox on the list row is a UI port (issue #12). |
| 21 | Projects as threads (title, summary/goal, status, tags) with AI matching and AI creation | See finding 4. Project detail groups Active vs Done & archived (`App.jsx:446-521`); delete unlinks entries (`api.js:58-64`). | Projects = name + colour + timeline of actions (`projects/index.tsx`, `projects/[id].tsx`); user assigns at review or on the note form. No project detail edit, no delete. | port with changes | L | Issue #8. Needs: migration (summary, status), Edge Function receives the user's project titles as the enum, server-side match resolution, `proposed_project` flow, "Create project & link" in review. Handled's colour stays. |
| 22 | Project "slipping" signal (quiet ≥14 d) | `Dashboard.jsx:37-48`. | None. | port from Kern | S | Pure client computation over existing data once projects carry entries. |
| 23 | Categories (inbox/work/personal/meeting/idea) | None. Kern has no user-side taxonomy beyond type + project. | User-picked at review and on the note form (`project-utils.ts:3-9`, `review.tsx:284-309`); coloured label on every card. | conflicts — decision needed | – | Kern's PRD would call this manual upkeep (`prd.md:42-44`). Handled uses it as its primary visual grouping. Decision 2 covers whether `category` survives, shrinks, or is folded into projects/tags. |
| 24 | Inbox / Timeline list | Not a tab. Inbox = overlay with review queue + "Handled today" activity rows (`App.jsx:150-174,226-250`). | "Timeline" tab: all actions newest-first with type filter chips, category·type label, status, project·date line (`inbox.tsx`). | conflicts — decision needed | M | Different meanings of "inbox". Kern's is a gate (needs-review only, badge count); Handled's is the whole history. Decision 7 (UI conventions). |
| 25 | To-dos tab (due-sorted, Loose/In-projects scopes) | `App.jsx:291-330`. | Timeline filter chip "Tasks" (`inbox.tsx:15-21`); newest-first, no due sort. | port from Kern | M | Depends on #18 and #16. Sort rule (dated ascending, then undated newest) is ~10 lines. |
| 26 | Library (ideas + knowledge bank, search, archived collapsed) | `App.jsx:333-389`; substring search over title/body/tags. | No search anywhere. Timeline "Notes" chip. | port from Kern | M | Search: client-side filter is fine at Kern's scale; Postgres FTS later (README already plans it, `README.md:164`). |
| 27 | Today dashboard (digest line, needs-review inline, due/overdue rows with one-tap done, daily resurfacing, slipping) | `Dashboard.jsx` (159 lines). Date-seeded resurfacing pick (`:31-35`). | Home = capture hero + "Write a note" + resume-review card + retry cards (`home.tsx`). | port with changes | M | Issue #10. All computations are client-side over already-loaded lists; the RN work is the cost. Where the mic lives (hero vs FAB) is Decision 7. |
| 28 | Activity feed with Undo / Send to review | `ActivityRow.jsx`; lives under "Handled today" in the inbox overlay (`App.jsx:238-247`). | None. | port with changes | S–M | Only meaningful with auto-file (Decision 1). "Send to review" = set `status='pending'`. |
| 29 | Floating capture cluster (mic + pencil FAB on every screen), capture as overlay | `App.jsx:176-209`, PRD v0.2 (`prd.md:78-81`). Esc closes. | Capture is the Home tab (`mobile-navigation.tsx:7-12`); no FAB. | conflicts — decision needed | M | Decision 7. On RN, an overlay = modal route or a `Modal`; the recorder hook is already screen-independent (`use-voice-capture.ts`). |
| 30 | Entry-card visual language (white card on paper, checkbox/type dot lead, priority flag, due pill bottom-left, folder tab for project, no capture date, Show more) | Settled spec `CLAUDE.md:129-136`; CSS `styles.css:330-430`; commits `7c6ffcb`, `46ffdc0`, `2fead05`. | Rounded white cards on `#F7F8F5`, category·type eyebrow, status text, summary, project·**created date** line (`inbox.tsx:99-125`). Indigo brand (`theme.ts`). | conflicts — decision needed | M | Issue #12. The two decisions that collide with Handled today: no capture date on cards, and "one visual language per metadata kind" vs Handled's category-coloured eyebrow. Decision 7. |
| 31 | Export brief to Claude Code (full / "New only"), provenance, archive-on-export | `briefs.py` (137 lines): Goal/Context/Ideas/Next steps/History; `briefs` collection with `entries` relation; archives shipped knowledge/idea, never open todos; excludes needs_review (`briefs.py:86-121`). PWA: buttons, copy to clipboard, `<pre>` (`App.jsx:401-413,464-503`). Text limits raised after a real failure (`1756070000_raise_text_field_limits.js`). | None. Closest: research `shareMessage` copy/share (`research/[id].tsx:71-91`, web-only `share.ts:5-21`) and meeting briefing text (`meeting-utils.ts:3-24`). | port from Kern | M | Issue #11. Markdown generation is pure and deterministic — it can live in `src/features/briefs/` with unit tests and no Edge Function; only the `briefs` table + link table + `archived/exported_at` columns are server-side. Clipboard on native needs `expo-clipboard` (`setStringAsync`, SDK 57 docs); native share needs `expo-sharing`. Terminology rule from the Delta plan: label is "New only", never "delta mode". Decision 6. |
| 32 | Entry edit (type, priority, project, title, body) | Inline edit form (`EntryCard.jsx:106-136`). | Detail edit: title, details, when, message draft (`action/[id].tsx:254-293`). Type, category, project **not editable after save**. | port with changes | S | Add type/project/priority to the existing edit form. |
| 33 | Archive / restore (non-todo) | `EntryCard.jsx:313-319`. | `cancelled` status exists, never surfaced in UI. | port from Kern | S | `archived boolean` vs reusing `status='cancelled'`: keep separate — Kern archives *shipped* knowledge, which is not "cancelled". |
| 34 | Delete entry (keeps raw capture) | `EntryCard.jsx:69-78`. | Delete with confirm step (`action/[id].tsx:499-515`); `voice_captures.actions` FK is `on delete set null` so the capture also survives (`phase_1:39`). | Handled already has it | – | |
| 35 | Research with sources (web search, trust tiers, findings ↔ sources, reuse window, rate limit) | None. Out of scope by PRD (`prd.md:196`). | Full: `research` Edge Function, 4 tables, source policy + tests (`supabase/functions/research/index.ts`, `_shared/research/*`, `tests/source-policy.test.ts`). | Handled already has it | – | Keep. Interacts with Decision 4 (AI provider) because the source extraction walks an OpenAI Responses payload (`_shared/research/openai-response.ts:45-93`). |
| 36 | Meeting briefing + ICS download | None. | `meeting_contexts` table, `createIcsEvent` (`meeting-utils.ts:51-69`), web-only download (`share.ts:23-34`). | Handled already has it | – | Web-only today; native needs `expo-file-system` + `expo-sharing`. Not a Kern concern. |
| 37 | Contacts (people) + send via WhatsApp/SMS/email | None (PRD excludes CRM, `prd.md:194-195`). | `people` table, contacts screens, `expo-sms`/`Linking` composers (`contact-delivery.ts`). | Handled already has it | – | AI-extracted people are never linked (finding 5). Whether contacts stay is a scope decision for the owners, not a port question. |
| 38 | Message intent with ready-to-send draft | None. | `message_draft` column with check constraint (`phase_1:46,52-53`), editable on review and detail. | Handled already has it | – | No Kern equivalent; Kern's `todo` would swallow "message Karin about X". |
| 39 | Reminder intent + local notifications | None (ntfy planned, not built, `prd.md:168-169`). | `reminder` action_type and a `notifications` table (`phase_1:76-84`) — **no code reads or writes it**; `expo-notifications` is not a dependency (`package.json`). README "Phase 4" claims are future work (`README.md:163`). | Handled already has it (schema only) | M | Issue #14. `expo-notifications` local scheduling works in Expo Go on iOS/Android, not web (SDK 57 docs). Independent of Kern. |
| 40 | Plaud / external webhook ingest | Neutral `POST /api/ingest {source, transcript, external_id, audio_url}` (`main.py:48-54`); Plaud bridge not built (`prd.md:167`). | None. Every capture starts as an app upload. | port with changes | M | An Edge Function `ingest` accepting text + optional audio URL, authenticated with a per-user token (not the session), writing `voice_captures(source, external_id)`. Only worth it once async processing (#10) exists. |
| 41 | Deploy: Pi + tailscale serve, systemd, health timer | `CLAUDE.md:87-105`. | Mac mini static web + Tailscale serve (`deploy/mac-mini/README.md`); backend is Supabase cloud. | drop | – | Handled's split (static client + hosted backend) removes the always-on host requirement. The mini-PC is relevant only for Decision 4 (self-hosted transcription). |
| 42 | Build stamp in UI | `vite.config.js:8-13`, `Dashboard.jsx:126`. | None. | port from Kern | S | `expo-constants` `expoConfig.version` or a build-time env. Cheap and useful with two people deploying. |
| 43 | Seed script through the real pipeline | `backend/seed.py` (5 captures covering all outcomes). | None. | port with changes | S | A script that inserts `voice_captures` rows with transcripts and invokes the function; needs a test user + service key. Valuable for the classifier bake-off (issue #6). |
| 44 | Tests | None in Kern. | 21 Jest tests over pure utils and schemas (`tests/*.test.ts`). | Handled already has it | – | Every ported pure function (dueBucket, brief markdown, dedup key, project matching) should land with a test. |

---

## 2. Data model comparison

### 2.1 Captures — `K:captures` vs `H:voice_captures`

| Kern `captures` (`init_kern_schema.js:34-60`, `1751730000:23`, `1756070000:16`) | Handled `voice_captures` (`phase_1:24-34`) | Note |
|---|---|---|
| `id` (15-char PB id) | `id uuid` | |
| — | `user_id uuid` (RLS key) | Kern has no owner. |
| `source text` required (`pwa`, `plaud`, `seed`) | — | Needed for Plaud/webhook later. |
| `transcript text` required, max 100 000 | `transcript text` nullable | Handled captures exist *before* transcription; Kern's exist only with text. Handled's `research-service.ts:35-39` already creates audio-less rows with `processing_status='transcribed'` for typed notes — effectively Kern's "text capture", done as a workaround. |
| `audio_url url` | `audio_path text` (private bucket path, checked against `user_id`) | Equivalent intent; Handled's is safer. |
| `dedup_key text` unique | — | See inventory #7. |
| `status ∈ pending/processed/error` | `processing_status ∈ recorded/uploaded/transcribed/failed` | Handled's states track upload; Kern's track classification. Merged enum needs both halves. |
| `error_detail text` | — | Handled logs to the function console only (`process-capture/index.ts:308-312`). |
| `created`, `updated` autodate | `created_at` | |

### 2.2 Entries — `K:entries` vs `H:actions`

| Kern `entries` | Handled `actions` | Note |
|---|---|---|
| `type ∈ todo/idea/knowledge` (`1751920000`) | `action_type ∈ note/task/reminder/message`; AI `intent` adds question/statement/research_request, folded to `note` on save (`action-schema.ts:60-63`) | **Meaning conflict.** Proposed mapping below. |
| — | `category ∈ inbox/work/personal/meeting/idea` (user-picked) | No Kern equivalent. `idea` collides with Kern's type. |
| `title text` required | `title text` 1–280 | Same. |
| `body_clean text` (constrained markdown, ≤100 000) | `summary text` (prose, AI-capped 2 000) | **Meaning change** if Kern rules are adopted: `summary` becomes a markdown body; `summaryPoints()` in two screens must go. |
| `project → projects` | `project_id → projects` | Same shape; Handled's is RLS-checked (`…timeline.sql:67-74`). |
| `priority ∈ {high}` / empty | — | Add `priority boolean`. |
| `due date` (day) | `scheduled_at timestamptz` + `scheduled_timezone` | Different semantics. Keep both: `due_date date` for todos, `scheduled_at` for reminders/meetings. |
| `tags json` | — | Add `tags text[]` (optional). |
| `confidence number 0–1` | `confidence numeric(3,2)` | Same. |
| `needs_review bool` | `status='pending'` exists, never written; `requires_clarification bool` + `clarification_question` | Recommend `status='pending'` ≙ needs_review (no new column). `requires_clarification` stays as the *reason*. |
| `status ∈ open/done` | `status ∈ pending/approved/completed/cancelled` | open→approved, done→completed. |
| `archived bool`, `exported_at date` (`1751710000`) | — | Add both; brief export sets them. |
| `proposed_project text` (`1751730000`) | — | Add; drives "Create project & link". |
| `classifier text`, `prompt_version text` | — | Add; needed for threshold tuning (Kern's stated reason, `1751730000:4-6`). |
| `source_capture → captures` | `voice_capture_id → voice_captures` | Same. |
| — | `message_draft text` (+ check: only for `message`) | Keep. |
| — | `people` (via `action_people`, roles recipient/mentioned) | Keep; AI-extracted people are currently dropped on save. |
| `created`, `updated` | `created_at`, `updated_at` (trigger) | Same. |

**Type mapping proposal (for Decision 2):**

| Kern type | Handled action_type | Comment |
|---|---|---|
| todo | task | Clean. |
| todo with explicit time | reminder | Kern would set `due` (day) only; Handled keeps the timestamp. Treat reminder = task + `scheduled_at`. |
| knowledge | note | Clean. Kern retired `note` because it conflated "nature" with "attached to project"; in Handled `note` already means "no action required", i.e. Kern's knowledge. |
| idea | — (only as `category`) | **Gap.** Either add `idea` to `action_type` or drop the `idea` category. |
| — | message | Keep; no Kern equivalent. |
| project (new container) | — | Not an entry type; a side effect (`main.py:123-133`). Port as behaviour, not as a type. |
| addition | — | Not a type; `project_id` set. Same in both. |

### 2.3 Projects — `K:projects` vs `H:projects`

| Kern (`init_kern_schema.js:9-31`) | Handled (`…timeline.sql:8-18`) | Note |
|---|---|---|
| `title` required | `name` 1–80, unique per user (case-insensitive) | Handled's uniqueness is what Kern's title-enum matching (`classifier.py:149-160`) silently assumes. Good. |
| `summary` (= brief's Goal, `briefs.py:72`) | — | Add. |
| `status ∈ active/paused/done` | — | Add. Kern's dashboard only counts `active` (`Dashboard.jsx:39`). |
| `tags json` | — | Optional; unused in Kern UI. |
| — | `color` (hex, checked) | Keep; Kern has none. |
| — | `user_id` | |

### 2.4 Briefs — `K:briefs` vs nothing

`K:briefs` (`init_kern_schema.js:118-141`, `1751730000:26-38`, `1756070000:15`): `project→` (cascade delete), `markdown` (≤500 000), `generated_at`, `mode ∈ full/delta`, `entries→[]` (provenance, max 999). Handled has no equivalent; `meeting_contexts` (`research_and_meetings.sql:79-93`) is the nearest "generated document" table but is bound to research, not projects.

### 2.5 Contacts / appointments / timelines

- **Contacts:** Handled only (`people`, `action_people`). Kern deliberately has none.
- **Appointments:** Handled `meeting_contexts` + `scheduled_at` on reminders. Kern has `due` only. Not the same feature; no merge needed.
- **Timelines:** Handled's "timeline" is a view (actions by `created_at`), not a table. Kern's project detail view is the same idea grouped by Active / Done & archived.

### 2.6 Proposed merged schema — migrations Handled would need

Numbered in dependency order; each is one file under `supabase/migrations/`, append-only, with the `authenticated` grants and RLS `with check` extensions that Handled's existing migrations use.

1. **`…_capture_pipeline_fields.sql`** — `voice_captures`: add `source text not null default 'app'`, `external_id text`, `dedup_key text`, `error_detail text`; add enum values `processing`, `processed`, `error` to `capture_processing_status` (Postgres `alter type … add value` cannot run inside the `begin/commit` the other migrations use — separate file or `commit` first). Unique index on `(user_id, dedup_key) where dedup_key is not null`. *Meaning change:* `transcribed` stops being terminal; `processed` is.
2. **`…_project_threads.sql`** — `projects`: add `summary text`, `status project_status not null default 'active'` (enum active/paused/done). No existing column changes meaning.
3. **`…_entry_nature.sql`** — `actions`: **Decision 2 dependent.** Minimal version: add `'idea'` to `action_type`; add `priority boolean not null default false`, `due_date date`, `tags text[] not null default '{}'`, `archived boolean not null default false`, `exported_at timestamptz`, `proposed_project text`, `classifier text`, `prompt_version text`. *Meaning changes:* `summary` becomes markdown-capable; `status='pending'` becomes "needs review" (today unused); `confidence` becomes a routing input, not a display value. Index `(user_id, status) where status='pending'` for the inbox badge; `(user_id, due_date) where action_type in ('task','reminder') and status <> 'completed'` for the dashboard.
4. **`…_briefs.sql`** — `briefs (id, user_id, project_id → projects on delete cascade, mode brief_mode, markdown text, generated_at)`, `brief_actions (brief_id, action_id)`; RLS owner-scoped; `generated_at` index per project. Client inserts are acceptable (same trust level as `meeting_contexts`), or an Edge Function if archive-on-export must be atomic (it is two statements: insert brief, update actions — an RPC function `export_brief(project_id, mode)` in SQL would make it atomic without an Edge Function).
5. **`…_category_cleanup.sql`** — **only if Decision 2 removes or shrinks `category`.** Enum values cannot be dropped in Postgres; the realistic path is a new enum + column swap, or leaving `category` in place and hiding it in UI. Flag now so it is not discovered mid-port.
6. **`…_capture_dedup_backfill.sql`** (optional) — backfill `dedup_key` from `sha256(normalised transcript)` for existing rows if dedup is adopted.

Not needed: a `notifications` change (table already exists), a `people` change.

**Existing Handled columns whose meaning changes:** `actions.summary` (prose → markdown body), `actions.status='pending'` (unused → needs review), `actions.confidence` (stored → routing), `voice_captures.processing_status='transcribed'` (terminal → intermediate), `actions.category='idea'` (would become redundant with `action_type='idea'`).

---

## 3. Pipeline comparison

### 3.1 Side by side

| Stage | Kern | Handled |
|---|---|---|
| Capture | Mic/pencil overlay; text or MediaRecorder blob (`Capture.jsx`). | Home hero mic; `expo-audio` file in document dir (`use-voice-capture.ts:26,67-85`). Typed note bypasses the pipeline entirely (`note/new.tsx`). |
| Persist raw | Text → `POST /api/ingest` → `captures` row immediately, **202** (`main.py:190-215`). Audio is transcribed *before* ingest and never stored (`/api/transcribe` returns text only, `main.py:218-248`; `audio_url` is accepted but the PWA never sends one). | Audio → private bucket + `voice_captures(recorded→uploaded)` (`capture-service.ts:40-73`). Audio **is** retained (README: no deletion job yet, `README.md:171`). |
| Transcribe | Deepgram nova-3 multi, client-initiated, result shown as "Heard:" (`Capture.jsx:314-318`). | Inside `process-capture`: download → OpenAI transcription (`index.ts:238-263`). Transcript saved to `voice_captures` only *after* the intent call succeeds (`:300-304`) — a failed intent call loses the paid transcript. |
| Classify / understand | Background task; Haiku structured output with live project-title enum; Sonnet escalation on doubted additions; confidence gate (`main.py:166-188`, `classifier.py`). | Same request; gpt-4.1-mini strict JSON schema; no project context; no escalation; Zod re-validation server (`index.ts:297-298`) and client (`use-voice-capture.ts:103-104`). |
| Rewrite | Mandatory: `title` + `body_clean` under hard rules (`classifier.py:96-113`). | `title` + `summary`, no rules (`index.ts:272`). |
| Structured entry | Server writes `entries` (+ maybe `projects`) **without the user** (`main.py:95-164`). | **Nothing written** until the user saves; draft in AsyncStorage (`action-review-provider.tsx`). |
| Review | *After* filing, *only* for the doubt band, in the inbox overlay; high-confidence items are reviewable via the activity feed's "Review"/"Undo" (`ActivityRow.jsx`). Low band (<0.45) keeps the raw transcript as body (`main.py:101-111`). | *Before* saving, *always*, on `/review`; user can edit title/summary/when/message draft, pick category + project, choose research (`review.tsx`). |
| Save | Implicit (already saved); approve = `needs_review=false` (`EntryCard.jsx:66-67`). | Explicit insert with `status='approved'` (`action-service.ts:27-58`). |
| Inbox / give-back | Today dashboard, To-dos, Library, project detail, activity feed. | Timeline list, project timeline, contact timeline, research list. |
| Export | Brief per project → markdown, archives shipped entries (`briefs.py`). | None. Research → share message / meeting ICS. |
| Research | None. | Optional, user-pressed, separate Edge Function (`research/index.ts`). |

### 3.2 Where they disagree — stated, not resolved

**Disagreement A — when the user reviews.**
- Handled: review is a *gate before persistence*. Nothing the model produced exists in the database until approved. Consequence: a crash, a closed tab, or a second recording before review leaves the transcript in `voice_captures` but no action; the draft survives only in one device's AsyncStorage (`action-review-provider.tsx:36-56`).
- Kern: review is a *correction after persistence*, and only when the model itself is unsure. Consequence: a thought is never lost, but the database contains model output the user has not seen; trust is bought back with the activity feed + undo (`prd.md:45-47`).
- These are not compatible defaults. A hybrid ("auto-file only above X, otherwise Handled's review screen") is possible but changes Handled's README promise (`README.md:5`) and needs the `status='pending'` semantics from §2.6.

**Disagreement B — what the model may change.**
- Kern: the model *must* rewrite (restructure, strip filler) and *must not* translate, change perspective, or drop any fact (`classifier.py:96-101`). Output is constrained markdown that the UI renders (`md.jsx`).
- Handled: the model produces "one useful action"; nothing constrains language or completeness; the model additionally *infers* people, a schedule, a message draft, research suitability and a clarification question (`index.ts:10-73`). The UI treats `summary` as sentences to bullet-ize (`review.tsx:28-34`).
- Kern's "never invent content" (`classifier.py:101`) and Handled's "never invent a critical time or a contact" (`index.ts:272`) agree on the principle; Handled just extracts more fields and Kern rewrites more text.

**Disagreement C — typed text.**
- Kern: typed text is a capture and goes through the classifier (`api.js:25`, `Capture.jsx:224-230`).
- Handled: typed text is a manual note with user-chosen category/project/person and no AI (`note/new.tsx`, `action-service.ts:60-94`). Research on such a note fabricates a `voice_captures` row to satisfy the research function (`research-service.ts:20-50`).

**Disagreement D — what a project is to the model.**
- Kern: the model sees project titles + summaries and decides attachment; the server decides whether to trust that (`main.py:114-117`); a new project can be created by the model above the threshold (`:123-133`).
- Handled: the model never sees projects; the user attaches at review (`review.tsx:310-345`). Projects are created only by the user (`projects/index.tsx:31-42`).

**Disagreement E — synchronous vs asynchronous processing.**
- Kern: capture returns in milliseconds; classification happens later; the client polls (`Capture.jsx:23-36`), and Plaud/webhooks can post without waiting (`main.py:9-13`).
- Handled: one round-trip does everything; the client waits with a raised timeout (commit `a0be1f1`, `fetch-with-timeout.ts`). Retry re-transcribes (inventory #8).

**Disagreement F — raw audio.**
- Kern never stores audio (only the transcript). Handled stores audio privately and has no retention job. Not a Kern port question, but the merged app inherits Handled's GDPR surface (`README.md:171-173`).

---

## 4. Decisions for the two owners

Each: question → options → cost → recommendation. Numbering is independent of the GitHub issues; the issue that each decision unblocks is noted.

### Decision 1 — Review before save (Handled) or auto-file with confidence gate (Kern)? *(unblocks #7, #10, #14)*

- **Option A — keep Handled's gate.** Every capture goes to `/review`. Cost: nothing to build; Kern's dashboard "Needs review" becomes "Unreviewed drafts" and the activity feed with undo has no purpose. Kern's core value ("capture in two taps, the system files it", `prd.md:37-39`) is not delivered.
- **Option B — adopt Kern's gate.** ≥0.75 saved as `approved`, 0.45–0.75 saved as `pending`, <0.45 saved as `pending` with raw transcript as body. Cost: the Edge Function writes `actions` rows (service role, currently it only writes `voice_captures`), the review screen becomes an inbox queue, activity feed + undo are required (not optional) to keep the trust story, README/product rule changes. Roughly M for the function, M for the UI.
- **Option C — hybrid by intent.** Auto-file Kern-shaped outcomes (task/note/idea) above the threshold; always review anything with `people`, `messageDraft`, `scheduledAt` or `requiresClarification` (i.e. anything that could reach a third party or the calendar). Cost: same plumbing as B plus a routing rule; slightly harder to explain.
- **Recommendation: C.** It preserves Handled's "never sends anything without review" guarantee where it matters (messages, reminders with time) while giving Kern's two-tap capture for the bulk (notes/tasks/ideas). Make the threshold a per-user setting later, not now.

### Decision 2 — One "nature" axis: what happens to `action_type`, `intent` and `category`? *(unblocks #9, #12, migration 3/5)*

- **Option A — extend `action_type` with `idea`; keep `category` untouched.** Cost: S migration; the word "idea" means two things in the UI; every card keeps showing "Ideas · Note".
- **Option B — extend `action_type` with `idea`; retire `category`.** Cost: enum values cannot be dropped, so the column is hidden in UI and defaulted to `inbox`; screens that use `categoryDetails()` (`inbox.tsx`, `projects/[id].tsx`, `contacts/[id].tsx`, `review.tsx`, `note/new.tsx`) change; Handled's "meeting" grouping is lost unless expressed as a project or tag.
- **Option C — keep `category` as the visible taxonomy and map Kern's type onto it** (idea→category idea, knowledge→note+inbox…). Cost: Kern's To-dos/Library split becomes impossible to express cleanly; the model cannot set categories without inventing "work vs personal", which Kern explicitly forbids as manual upkeep.
- **Recommendation: B**, keeping `action_type ∈ {note, task, reminder, message, idea}` as the single nature axis and `project_id` as attachment. `meeting` survives as Handled's `meeting_contexts`, which is the actual meeting feature. This is the one decision that should be taken *before* any port PR, because migration 3 and every card component depend on it.

### Decision 3 — Rewrite rules and body format. *(unblocks #6, #12)*

- **Option A — adopt Kern's rules verbatim** (language, first person, no info loss, constrained markdown). Cost: prompt change (S); `summary` becomes markdown; a `MdBody` RN component replaces `summaryPoints()` in `review.tsx` and `action/[id].tsx` (M); the review screen's "key points" bullets disappear.
- **Option B — adopt the language/first-person/no-info-loss rules but keep plain prose.** Cost: prompt only (S); Handled's sentence-splitting stays; long rambles remain paragraphs.
- **Option C — keep Handled's prompt.** Cost: none; NL captures may come back in English, names/codes may be dropped — the exact failures Kern's self-test fixed (commit `cb944e1`).
- **Recommendation: A.** The rules are the part of Kern with the most real-usage iteration behind them (prompt versions `2026-07-07.2` → `2026-07-08.2`). Store `prompt_version` from day one so the bake-off (#6) has data.

### Decision 4 — AI provider: OpenAI, Anthropic, or both. *(unblocks #6, #3)*

Facts: Handled's two functions are OpenAI-shaped end to end — Responses API strict `json_schema` (`process-capture/index.ts:274-281`), transcription endpoint (`:252-256`), and the research function's `web_search` tool with `include: ['web_search_call.action.sources']` and a payload walker written for that shape (`research/index.ts:230-255`, `_shared/research/openai-response.ts:45-93`). Kern is Anthropic-shaped: Messages API with `output_config.format` json_schema (`classifier.py:166-173`), Haiku 4.5 runtime, Sonnet escalation. Kern's memory notes that a Claude Max subscription does not cover API use; a separate key is needed either way.

- **Option A — OpenAI only.** Port Kern's *prompt and schema* to `process-capture`; keep research as is. Cost: one secret, one vendor, one failure mode; no bake-off data on whether gpt-4.1-mini matches Haiku 4.5 on NL/EN classification; Kern's Sonnet escalation becomes "a second call to a bigger OpenAI model".
- **Option B — Anthropic only.** Rewrite `process-capture` (M) *and* `research` (L: the web-search tool, source shape and citation policy are all different). Cost: throws away the most tested code in Handled (`tests/source-policy.test.ts`) for no product gain.
- **Option C — both: Anthropic for classify/rewrite, OpenAI for transcription and research.** Cost: two secrets, two billing accounts, two error paths in the same function; a provider abstraction in `_shared/` so the classifier is swappable.
- **Recommendation: A first, decided by the bake-off, with C as the fallback.** Build the classifier port behind a small provider interface (`classify(transcript, projects, today) → Classification`) so the bake-off in issue #6 can run both on the same seed set (inventory #43). Switch to C only if Haiku measurably wins on the NL/EN rules. Do not pursue B.

### Decision 5 — Transcription: OpenAI API, Deepgram, or self-hosted faster-whisper on the mini-PC. *(unblocks #6, #10, #40)*

Facts: Handled calls OpenAI `gpt-4o-mini-transcribe` from an Edge Function with no language hint. Kern calls Deepgram nova-3 with `language=multi` specifically for NL/EN code-switching (`config.py:18-20`) and its owner recorded that browser dictation was "much worse" (`.env.example:9`). The dev machine is an AMD Ryzen AI Max+ 395 / Radeon 8060S (`gfx1151`) / 128 GB unified / Windows 11.

- **Option A — stay on OpenAI.** Cost: zero change; unknown quality on mixed NL/EN (no evidence either way in this repo); per-minute API cost.
- **Option B — Deepgram from the Edge Function.** Cost: S (one `fetch`, one secret, content-type passthrough exactly as `main.py:230-243`); a second vendor; Deepgram's free credit then paid tier.
- **Option C — self-hosted faster-whisper on the mini-PC.** Cost: the Edge Function runs in Supabase's cloud, so audio must leave Supabase and reach a home machine — Tailscale Funnel or a public reverse proxy with auth — which contradicts the "private" posture both apps have. Availability of the shared product would depend on one owner's PC. On the hardware side: faster-whisper runs on CTranslate2, whose GPU backend is CUDA; AMD/ROCm support for `gfx1151` on Windows was **not verified in this session** and should be assumed absent until tested, which leaves CPU inference or a different engine (whisper.cpp with Vulkan). Effort L and it is infrastructure, not product.
- **Recommendation: A now, B as the tested alternative, C not for the shared app.** Run the transcription bake-off on the same NL/EN clips as the classifier bake-off. If the mini-PC is used at all, use it for *offline batch* work (e.g. re-transcribing the archive) via a script, never as a runtime dependency of the phone flow.

### Decision 6 — Brief export to Claude Code. *(unblocks #11)*

- **Option A — port as designed:** full / "New only", archive-on-export, provenance table, copy to clipboard. Cost: migration 4 (S), `src/features/briefs/build-markdown.ts` with tests (S), project screen buttons + `expo-clipboard` (S), archive semantics in the To-dos/Library views (S). Total M.
- **Option B — port only "full" export, no archiving.** Cost: smaller (S); "New only" — the handoff-protocol idea Kern's memory calls "parked with intent" — is lost, and the Library never distinguishes shipped from unshipped knowledge.
- **Option C — drop.** Cost: none; the feature Kern's owner names as the killer feature (memory: "Kern's killer feature is classifying voice ideas under projects; … Daniel is currently the manual connector") disappears from the merged product.
- **Recommendation: A**, with two adjustments: (1) archive-on-export as a Postgres RPC so it is atomic; (2) the brief builder is pure TS, unit-tested against Kern's `build_markdown` output on the same fixture so the format is byte-compatible with what Claude Code sessions already expect. Also decide whether "brief" applies to Handled's contacts/research (Kern's brief has no research section — it could gain a "Sourced findings" section from `research_sessions`, which is a genuine merge benefit).

### Decision 7 — UI conventions: Kern's card language, FAB overlay and tabs vs Handled's current UI. *(unblocks #10, #12, #29)*

What is actually in conflict, item by item:

| Convention | Kern (settled after live iteration, `CLAUDE.md:129-140`) | Handled today | Conflict? |
|---|---|---|---|
| Card surface | White on paper `#EFEFE4`, Montserrat, Paper skill tokens | White on `#F7F8F5`, system font, indigo brand `#4F46E5` | Style only — not a functional conflict. |
| Capture date on cards | **None** ("clutter, not information", `EntryCard.jsx:273-276`) | Shown on every timeline/project/contact card (`inbox.tsx:118-123`, `projects/[id].tsx:87`) | Yes. Handled's "timeline" *is* the date axis. |
| Type indicator | Checkbox (todo) or type dot; no badge in single-type views | "Category · Type" coloured eyebrow on every card | Yes; depends on Decision 2. |
| Priority | Small flag in the title, binary | None | No conflict (new). |
| Due | Pill bottom-left, red when overdue | "When" tile with time on detail; date+time text in list | Partly; two date notions (§2.2). |
| Project | Folder tab on the card's top edge | "Project · date" text line; colour dot on project list | Yes (visual). |
| Capture entry | FAB mic+pencil on every screen, overlay | Home tab is the capture screen | Yes (navigation). |
| Inbox | Overlay with badge, needs-review only | "Timeline" tab, everything | Yes (meaning). |
| Tabs | Today / To-dos / Library / Projects | Capture / Timeline / Projects / People | Yes; People has no Kern slot, Today has no Handled slot. |

- **Option A — adopt Kern's card language and IA wholesale** (Today / To-dos / Library / Projects / People, FAB capture, inbox overlay). Cost: every list screen is rewritten (M–L); Handled's "timeline" framing (README, copy, `inbox.tsx`) disappears; Julien's design work is replaced.
- **Option B — keep Handled's IA, adopt Kern's card rules where they do not fight it** (priority flag, due pill, folder tab, one-language-per-metadata, no type badge in single-type lists), keep capture dates because the tab is literally called Timeline. Cost: M; the "no capture dates" decision is knowingly overridden in the Timeline tab only.
- **Option C — Kern's IA with Handled's visual theme** (tabs, FAB, overlay from Kern; colours, fonts, radii from Handled). Cost: same as A for screens, less for tokens.
- **Recommendation: C, staged.** The IA decisions in Kern came from real daily use (commits `4c7b562`, `a9143b0`, `7c6ffcb`), the Handled IA has not been used daily yet. But theme tokens are cheap and the Paper skill is installed only on Daniel's machine (`K:CLAUDE.md:35-38`), so it cannot be a shared-repo dependency. Stage 1 (issue #12): `EntryRow` component with Kern's rules in Handled's tokens, used by Timeline/Project/Contact lists — no IA change. Stage 2 (issue #10): Today tab + FAB. Stage 3: To-dos/Library replacing the Timeline filter chips. Decide "no capture dates" per tab, not globally.

### Decision 8 — Synchronous or asynchronous processing. *(unblocks #13, #40; strongly interacts with Decision 1)*

- **Option A — stay synchronous.** Cost: none now; blocks Plaud/webhook ingest and makes Option B/C of Decision 1 awkward (the client is waiting anyway, so "auto-file" just means "skip the review screen").
- **Option B — go asynchronous.** Client marks `uploaded` and returns; a database trigger/webhook (Supabase Database Webhooks → Edge Function) runs transcription + classification; client subscribes to `voice_captures` via Realtime or polls; failures land in `error_detail`. Cost: M; Realtime adds a dependency; idempotency (inventory #8) becomes mandatory.
- **Recommendation: A until Decision 1 lands, then B in the same PR as auto-file**, because auto-file without async gives none of Kern's "drop a note in a slot" feel, and async without auto-file has nothing to do while the user waits.

### Decision 9 — Typed text: capture or form? *(unblocks #6/#7 for text, #13)*

- **Option A — Kern: typed text enters the same pipeline** (creates a `voice_captures` row with `transcript` and no audio — Handled already does exactly this for research, `research-service.ts:35-39` — then runs the classifier). Cost: S once the Edge Function accepts a capture without audio; the note form shrinks to a textarea; category/project/person pickers move to the review/inbox step.
- **Option B — Handled: keep the manual form.** Cost: none; Kern's principle 1 is violated; two ways to create a note with different fields.
- **Recommendation: A**, keeping "Add a note to this project/person" as *prefilled context* passed to the classifier, not as a bypass.

### Decision 10 — Scope items with no counterpart (contacts + messaging, research, meeting ICS on the Handled side; Plaud, ntfy on the Kern side).

Not port questions, but they determine the tab bar and the migration count. Recommendation: keep all Handled features (they are built and tested), park Plaud and ntfy exactly where Kern parked them. Record the decision in `CLAUDE.md` (issue #5) so agents stop re-proposing them.

### Decision 11 — Data migration PocketBase → Supabase.

Kern's `pb_data` has one copy on the Pi and no backup (memory: "GitHub is no backup of the knowledge base"). A one-off script (PB REST → Supabase insert under Daniel's user) is S once migrations 1–4 exist. Decide *whether* (import history or start clean) — the recommendation is to import, because the "New only" brief semantics and the resurfacing pool are worthless on an empty database.

---

## 5. Proposed port order

One PR each, smallest-risk first. "Depends on" refers to earlier PRs or decisions. Ops issues #1–#5 are prerequisites for all of this and are not repeated.

| PR | Scope | Effort | Depends on | Risk notes |
|---|---|---|---|---|
| P1 | **Idempotent processing + transcript-first save.** In `process-capture`: skip transcription when `voice_captures.transcript` is set; write the transcript *before* the intent call; add `error_detail`. Migration 1 (capture fields). | S | — | Pure improvement to Handled; no product decision needed. Saves money on every retry. |
| P2 | **Pure utilities with tests.** `dueBucket`, `daysSince`, `timeAgo`, dedup key, project title resolution (`_resolve_project` logic), brief markdown builder, `MdBody` renderer. Ports of `K:utils.js`, `K:main.py:67-83`, `K:briefs.py:30-83`, `K:md.jsx`. No screens, no schema. | S | — | Zero runtime risk; gives later PRs tested building blocks and a fixture set. |
| P3 | **Project threads (schema + UI).** Migration 2; project detail gets summary/status edit and delete-with-unlink (`K:api.js:58-64`). Classifier still unaware. | S–M | — | Purely additive. |
| P4 | **Entry nature + fields.** Migration 3 per Decision 2; `action_type` extended; `priority`, `due_date`, `tags`, `archived`, `exported_at`, `proposed_project`, `classifier`, `prompt_version`; edit form gains type/project/priority; `status='pending'` documented as "needs review". No routing change yet. | M | Decision 2 | Enum migration is irreversible in practice; get the decision signed off first. |
| P5 | **Classifier rules port + bake-off harness.** Prompt and schema from `K:classifier.py` into `process-capture` (language, first person, no info loss, markdown, priority, due, tags, project enum from the user's projects); seed script (inventory #43) with a shared NL/EN fixture; `prompt_version` stamped. Review screen renders markdown via `MdBody`. | M | P2, P3, P4, Decisions 3–4 | Highest *quality* risk, lowest *data* risk: nothing auto-files yet, the user still reviews everything. This is where the OpenAI-vs-Anthropic comparison is run. |
| P6 | **Entry-row design language.** `EntryRow` component (checkbox/type dot, priority flag, due pill, folder tab, Show more, done-collapsed) used in Timeline, project and contact lists; To-dos sort rule. Per Decision 7 stage 1. | M | P4, Decision 7 | UI-only; reversible. Do this with the live-iteration loop Kern used (memory: dev server + temp data + Daniel watching). |
| P7 | **Brief export.** Migration 4 + RPC `export_brief`; project screen buttons ("Export brief", "New only"), clipboard via `expo-clipboard`, native share via `expo-sharing`; archived section in Library/project views. | M | P2, P3, P4, Decision 6 | Data-changing (archives entries) but scoped to one explicit button. |
| P8 | **Typed capture through the pipeline.** Note form becomes a capture; Edge Function accepts audio-less captures; "add to project/person" passes context. Removes the research workaround in `research-service.ts:20-50`. | S–M | P5, Decision 9 | Touches research; keep `captureForResearch` behaviour covered by a test before removing it. |
| P9 | **Async processing + offline outbox v2.** Database webhook → `process-capture`; client subscribes/polls; typed captures queued offline; auto-flush on reconnect; dedup on transcript. Issue #13. | M | P1, P8, Decision 8 | Infrastructure change; do it *before* auto-file so failures are visible with the review screen still in place. |
| P10 | **Confidence gate + inbox queue + activity feed with undo/send-to-review.** Edge Function writes `actions` (approved / pending per Decision 1); review screen becomes the inbox queue for `pending`; "filed" result with refile chips; activity rows. Issues #7, #14 (partly). | L | P4, P5, P9, Decision 1 | The product-rule change. Ship behind a per-user flag defaulting to "review everything" so Julien's flow is unchanged until both owners opt in. |
| P11 | **Projects: AI matching, escalation, proposed_project, "Create project & link".** Issue #8. | M | P5, P10 | Needs auto-file semantics to be meaningful (a doubted match must land somewhere reviewable). |
| P12 | **Today dashboard + FAB capture cluster + tab restructure** (Today / To-dos / Library / Projects / People). Issue #10, Decision 7 stages 2–3. | M–L | P6, P10, P11 | Largest UI change; last because every widget on it reads fields created by earlier PRs. |
| P13 | **Webhook ingest (Plaud-ready)** — authenticated `ingest` function, `source`/`external_id`. Issue #40. | M | P9 | Optional; only when a second source exists. |
| P14 | **Data import PocketBase → Supabase.** One-off script, Daniel's user only. | S | P3, P4, P7, Decision 11 | Run once, keep the script in `scripts/`. |

Handled's own base issues (#14 notifications, #15 context search, #16 hardening) are independent of this order except that #14 should reuse `due_date`/`scheduled_at` semantics fixed in P4.

---

## Appendix — README / PRD claims vs code

| Claim | Where | Reality |
|---|---|---|
| "Research results offer … universal ICS download" | `H:README.md:23` | Web only; native throws (`share.ts:23-26`). |
| "the link table checks ownership…" (people linked to actions) | `H:README.md:116` | Schema and RLS exist; AI-extracted people are never written (`action-service.ts:27-58`). Only the manual note form and "Use X for this action" write links. |
| `ContextProvider` with `searchPeople`, `searchPreviousNotes` | `H:README.md:101` | Interface only (`context-relevance-service.ts`), nothing implements or calls it. |
| `notifications` table "Local reminder delivery state" | `H:README.md:114` | No client or function code touches it. |
| "Actions: build review, confirmation/edit/discard, timeline, detail, completion, deletion, and local notifications" | `H:README.md:163` | All present except local notifications. |
| "Edge Function … with rate limiting, validation, timeouts, observability, and a retry-safe capture state machine" | `H:README.md:179` | Research has a 2/min rate limit (`research/index.ts:22,197-206`); `process-capture` has none, no idempotency, and the state machine ends at `transcribed`. |
| Kern "Capture: Plaud (openplaud bridge or Zapier trigger)" locked | `K:CLAUDE.md:25-26` | Not built; `/api/ingest` accepts it, nothing sends it (`prd.md:167`). |
| Kern "ntfy push / daily digest" | `K:prd.md:128-130,168-169` | Not built; no APScheduler in `requirements.txt`. |
| Kern "voice-based editing of entries" next | `K:CLAUDE.md:141` | Not built. |
| Kern PocketBase auth "lock down at Pi deploy" | `K:init_kern_schema.js:4` | Rules still `""` in every migration; hardening explicitly deferred (`CLAUDE.md:147-151`). |
| Kern "delta" mode | `K:briefs.py:12-14`, `main.py:254` | Exists in the API as `mode=delta`; the UI already labels it "New only" (`App.jsx:469-472`), matching the Delta naming rule. |
