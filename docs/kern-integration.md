# Kern → Handled: functional comparison

This document compares the two apps as **products**: what the user does, what the app does for them, and where the two apps want different things. It is written so the two owners can decide what the merged app should *do*. How to build it is a separate question; the technical analysis that backs every statement here is in [`kern-integration-technical.md`](kern-integration-technical.md) and is meant for the agents once the functional decisions are made.

Written 2026-08-29 against the current code of both apps. Where a README or plan describes something the app does not actually do yet, that is said explicitly.

---

## The five things that matter most

1. **Handled asks you to approve every thought before it is saved. Kern saves first and only asks when it is unsure.** This is the biggest difference and it is a product choice, not a detail. Handled's promise is "nothing exists until you said yes". Kern's promise is "two taps and it's filed; you can always undo". The merged app cannot do both by default.

2. **Kern rewrites your words under strict rules; Handled summarises freely.** Kern must keep your language (Dutch in, Dutch out), keep "I" as "I", keep every name, number and date, and only clean up filler and structure. Handled has no such rules and may return an English summary of a Dutch note. Kern's rules came out of real daily use and self-tests; they are the part of Kern with the most iteration behind it.

3. **The two apps sort thoughts into different boxes.** Kern: a thought is a **to-do**, an **idea** or **knowledge**, and it may belong to a **project**. Handled: a thought is a **note**, **task**, **reminder** or **message**; you additionally file it under a **category** (Inbox / Work / Personal / Meetings / Ideas) and optionally a **project** and a **person**. "Idea" is a box in both apps but means a different kind of box. One system has to win, or the UI shows two labels for one thing.

4. **In Kern a project is something the AI knows about; in Handled a project is a coloured label you attach yourself.** Kern shows the AI your project list, lets it say "this belongs to project X", lets it propose a new project, and lets you confirm with one tap. Handled never tells the AI about your projects; you pick one at review time. Kern's owner calls this classification-under-projects the app's killer feature.

5. **Some described features do not exist yet in either app.** Handled: reminders do not notify you, and people the AI recognises in a voice note are shown but not saved. Kern: no Plaud import, no push notifications, no login (anyone on the private network can read and change everything). None of these should be counted as "already there" when planning.

---

## What each app is, in one paragraph

**Handled** — "Say it once. Consider it handled." You record a thought; the app transcribes it, works out what kind of action it is (note, task, reminder, message), fills in who it involves and when, and shows you a review screen. You correct it, choose a category and a project, and save it to a timeline. From any saved note you can ask for **research** (a sourced answer with findings, talking points and counterpoints), turn that into a **meeting briefing** with a calendar file, or send a message to a **contact** via WhatsApp, SMS or email. Multi-user, each user sees only their own data.

**Kern** — a personal **second brain**. You speak or type a thought; the AI rewrites it cleanly, decides whether it is a to-do, an idea or knowledge, attaches it to a project if it fits, and files it. High-confidence results are filed without asking; doubtful ones wait in an inbox. The home screen is a daily digest: what is due, what needs a look, one old thought resurfaced, which projects have gone quiet. With one click a project is exported as a **brief** that a Claude Code session can work from. Single user, no login.

---

## Feature comparison

"Verdict" is a proposal, not a decision. Where a row says *decide*, the question is listed in the Decisions section below.

| Feature | Kern | Handled | Verdict |
|---|---|---|---|
| **Sign in, private data per user** | None. One user, no login. | Yes. Each user sees only their own notes, projects, contacts, recordings. | Keep Handled. Nothing to port. |
| **Record a thought by voice** | Tap mic, speak, tap stop. Shows a rough live transcript while you talk. | Tap mic, speak, tap stop. Shows elapsed time, no live words. | Same. The live preview is dropped (it is a browser-only trick and the final transcript replaces it anyway). |
| **Type a thought** | Same box as voice; the AI files typed text exactly like spoken text. Keyboard shortcut on desktop. | A form: title, details, category, project, person. No AI involved. | *Decide* (D6). |
| **Quick entry from outside the app** (iPhone Action Button, Android share sheet) | Yes: a link opens the app already recording; shared text lands in the capture box. | No. | Port. Small, useful. |
| **Works without a connection** | Typed thoughts queue and send automatically when back online. | Recordings are kept on the device and you tap "Retry upload" later. | Handled's version is the stronger one (it keeps the audio). Add automatic retry and cover typed thoughts. |
| **Same thought sent twice** | Detected and ignored. | Creates a duplicate. | Port later; matters once thoughts can arrive from other sources. |
| **Transcription** | Deepgram, tuned for mixed Dutch/English in one sentence. | OpenAI, no language setting. | *Decide* (D4). Quality on mixed NL/EN has not been compared. |
| **Waiting time after you stop** | You get "captured" immediately; the filing happens in the background and the result appears a few seconds later. | You wait on screen until transcription and understanding are both done, then land on the review screen. | Follows from D1. |
| **What the AI decides** | Type (to-do / idea / knowledge), a new project or a match to an existing one, priority (only if you said "urgent"), a due date (only if you said one), 1–4 tags, a confidence score. | Type (note / task / reminder / message / question / statement / research request), people mentioned, a date-time, a ready-to-send message draft, whether research would help, whether something is unclear (with a question back to you). | *Decide* (D2, D3). Neither list contains the other. |
| **How the AI rewrites your words** | Hard rules: same language, first person kept, no fact lost, filler removed, long rambles turned into short bullets. | One sentence of instruction: "turn this into one useful action". Result is a title plus a prose summary that the screen chops into up to four "key points". | *Decide* (D3). Recommendation: adopt Kern's rules. |
| **Review** | Only doubtful results wait for you, in an inbox with a badge. There you see the AI's version, its confidence, the original transcript, and one-tap buttons to change the type, approve, reject or edit. Confident results are filed directly. | Every result waits for you on a review screen before anything is saved. You can edit title, summary, time, message; choose category and project; then save. The original transcript is visible only after saving. | *Decide* (D1). |
| **Undo / "that was wrong"** | On the result screen: change type with one tap, or Undo (deletes the filed entry). In the inbox: a list of what was filed today with Review / Undo per line. | Discard on the review screen before saving; delete (with confirmation) after saving. | Follows from D1. If confident results are filed automatically, undo becomes essential. |
| **Priority** | A single flag ("this is priority"), set by the AI only when you said so. Shown as a small flag in the title. | None. | Port. |
| **Due date** | A day ("by Friday"). Overdue items get a red "overdue 3d" badge; to-dos are grouped today / tomorrow / this week / later. | A date **and time** ("2026-08-23 16:30") used for reminders and meetings. No overdue notion. | Keep both: a *due day* for to-dos and a *moment* for reminders/meetings. Port the overdue logic. |
| **Done / open** | Checkbox on every to-do row; done items collapse under "Done (n)". | "Mark completed" button on the detail page. | Same idea; port the inline checkbox. |
| **Tags** | AI adds 1–4 tags; they only power search. | None. | Optional. Low value today. |
| **Projects** | A project has a title, a goal/summary, a status (active / paused / done). The AI matches thoughts to projects and can propose new ones. The project page shows active items and a collapsed "done & archived" list, plus the export button. | A project has a name and a colour. You attach notes yourself. The project page is a timeline of its notes. | *Decide* (D2, D5). Recommendation: Kern's model, keeping Handled's colour. |
| **"Project went quiet"** | Home screen lists active projects with nothing new for 14 days. | None. | Port. |
| **Categories** (Inbox / Work / Personal / Meetings / Ideas) | None. Kern's plan explicitly avoids anything you have to maintain by hand. | Chosen by you on every note; the colour of the category is the main visual grouping. | *Decide* (D2). |
| **Home screen** | "Today" digest: a one-line summary (n due, n to review, n captured), needs-review items inline, due/overdue rows with one-tap done, one resurfaced old thought per day, quiet projects. | Capture screen: big mic, "Write a note", a card to resume an unfinished review, retry cards. | *Decide* (D7). |
| **Capture from any screen** | A floating mic + pencil button on every screen opens capture as an overlay. | Capture is its own tab. | *Decide* (D7). |
| **Lists / tabs** | Today · To-dos · Library (ideas + knowledge, with search) · Projects. Inbox is a badge-button that opens over any tab. | Capture · Timeline (everything, newest first, filter by type) · Projects · People. | *Decide* (D7). |
| **Search** | Library search over title, text and tags. | None. | Port. |
| **How a note looks in a list** | White card on a paper background. Checkbox or type dot, title, priority flag in the title, due pill at the bottom, project name as a folder tab on the card's top edge, "Show more" for long text. **No capture date on cards** — a deliberate decision after live iteration. | White rounded card. "Category · Type" in colour, status, title, two lines of summary, "Project · date". | *Decide* (D7). The capture-date rule collides with a tab called "Timeline". |
| **Edit after saving** | Type, priority, project, title, text. | Title, details, time, message draft. Type, category and project cannot be changed after saving. | Port the missing fields. |
| **Archive** | Ideas and knowledge can be archived (and restored); archiving also happens automatically when they are exported in a brief. | None visible. | Port with the brief export. |
| **Export a project brief for Claude Code** | One click produces a markdown document per project: Goal, Context (knowledge), Ideas & open questions, Next steps (open to-dos), History. "New only" gives just what was added since the last export. Exported knowledge and ideas are marked as shipped; open to-dos stay until done. Copy to clipboard. | None. Nearest thing: copying a research summary. | Port. *Decide* the details (D8). Kern's owner names this the reason the app exists. |
| **Research a note** (sourced answer, findings with links, talking points, counterpoints, share message) | None; out of scope by design. | Yes, on request, never automatic, with a source-quality policy and a per-minute limit. | Keep Handled. Consider a "Sourced findings" section in the project brief later. |
| **Meeting briefing + calendar file** | None. | Yes, from a research result. | Keep Handled. |
| **Contacts and sending** (WhatsApp / SMS / email drafts) | None; Kern's plan excludes anything CRM-like. | Yes: a People tab, per-person timeline, message drafts opened in the messaging app for you to send. | Keep Handled. Note: people the AI recognises in a voice note are currently *not* saved to the note. |
| **Reminders that actually notify** | Planned (push via ntfy), not built. | Planned (local notifications), not built. The word "reminder" exists as a type but nothing fires. | Neither has it. Handled's own backlog item. |
| **Import from Plaud or other recorders** | Planned; the entry point exists but nothing sends to it. | None. | Later, only after D1/D9. |
| **Where it runs** | Raspberry Pi at home, reachable only through Tailscale. | Web build on a Mac mini (Tailscale), data and AI in Supabase's cloud. | Keep Handled's setup. The home machine is no longer needed for the app to work. |

---

## How a thought travels through each app

**Kern**
1. You speak or type. The thought is saved *immediately* as a raw capture — nothing can be lost from here on.
2. The audio is transcribed; the text is sent to the AI together with your list of projects.
3. The AI returns: cleaned text, type, project match (or a proposed new project), priority, due date, tags, confidence.
4. The app decides on your behalf:
   - confidence ≥ 0.75 → filed, done. You see a "Filed" card with the result and the words it heard, plus "wrong type?" chips and Undo.
   - 0.45–0.75 → filed but flagged; waits in the inbox for your approval.
   - < 0.45 → kept as raw text with a title, in the inbox; nothing else is applied.
5. The home screen and the To-dos/Library tabs surface it later; the activity list lets you undo or send anything to review.
6. Per project, you export a brief when you want to hand the project to Claude Code.

**Handled**
1. You record. Audio is uploaded and kept privately.
2. You wait while it is transcribed and understood.
3. You see the review screen: type, title, key points, when, people, message draft, and — if the AI thinks facts would help — an offer to research. You pick a category and a project.
4. Only when you tap **Save** does a note exist. Discard and nothing remains except the recording.
5. It appears in the Timeline (and in the project's and person's timelines). From the note you can research, message a contact, complete or delete it.

**Where they genuinely disagree**
- **Trust up front vs. trust with undo.** Handled: you are the gate. Kern: the AI is the gate and you have an undo. Kern's own principle is "act autonomously, but show your work" (activity feed, review queue, never a blind guess).
- **How much the AI may rewrite.** Kern restructures aggressively but may not change meaning, language or perspective. Handled extracts more *fields* (people, time, message, research) but has no rule about the text itself.
- **Typed text.** In Kern it is a thought like any other and the AI files it. In Handled it is a manually filled form.
- **Projects.** Kern's AI knows them and uses them. Handled's does not.
- **Speed feel.** Kern: capture returns instantly, result arrives a few seconds later. Handled: one wait, then the review screen.

---

## Decisions for the two owners

Each decision: the question, the options in user terms, what each costs functionally, and a recommendation. The letters are referenced in the table above.

### D1 — Who is the gate: you, or the AI with an undo?

- **A. Handled as is.** Every thought goes through the review screen. Cost: Kern's two-tap capture, the "Filed" screen, the activity feed and the daily "needs review" count have no role; Kern's owner would still be using Kern.
- **B. Kern as is.** Confident results are filed without asking; doubtful ones wait in an inbox; everything can be undone. Cost: Handled's promise "nothing is saved until you approve" is gone; an undo and a "what got filed today" list become mandatory, not nice-to-have.
- **C. Hybrid.** File automatically when the result is a plain note, task or idea and the AI is confident. Always ask first when the result involves another person, a message to send, a specific time, or when the AI itself says something is unclear. Cost: one more rule to explain; otherwise the plumbing of B.
- **Recommendation: C.** It keeps the guarantee where it matters (nothing reaches a third party or your calendar unreviewed) and gives Kern's speed for the bulk of captures. Make it a per-user switch later.

### D2 — One way to sort thoughts

- **A. Add "idea" to Handled's types and keep categories.** Cheapest. Cost: "Ideas" exists twice (as a type and as a category); cards keep showing two labels.
- **B. Types become note / task / reminder / message / idea, and categories are retired.** Projects carry "what it belongs to", type carries "what it is". Cost: Handled's Work / Personal / Meetings grouping disappears; meetings live in the meeting-briefing feature instead. Every list screen changes its label.
- **C. Keep categories as the main grouping and squeeze Kern's types into them.** Cost: the AI cannot decide "work vs. personal" without guessing, and the To-dos / Library split cannot be expressed cleanly.
- **Recommendation: B.** This is the decision to take *first*, because almost every screen and the data structure depend on it and it is hard to reverse.

### D3 — Rules for the AI's rewriting

- **A. Adopt Kern's rules fully:** same language, first person, nothing lost, filler removed, short bullets for long rambles. Cost: the review and detail screens stop chopping the summary into "key points" and show the AI's structured text instead.
- **B. Adopt the language / first-person / nothing-lost rules but keep plain prose.** Cost: long rambles stay a wall of text.
- **C. Keep Handled's prompt.** Cost: Dutch notes may come back in English, names and codes may vanish — the exact failures Kern already fixed.
- **Recommendation: A.**

### D4 — Which AI, and which transcription

- **AI provider.** Handled runs on OpenAI (understanding, transcription, research). Kern runs on Claude (Haiku, with a bigger model for hard project matches). The research feature is the hardest thing to move. Options: OpenAI only (port Kern's *rules*, not its vendor); Claude only (rebuild research); or both (Claude for classifying, OpenAI for transcription and research). **Recommendation:** start OpenAI-only, but build the classifier so both can be tried on the same set of test thoughts; switch to "both" only if Claude is measurably better on the Dutch/English rules. Do not rebuild research.
- **Transcription.** OpenAI (as now), Deepgram (as Kern, tuned for mixed NL/EN), or a self-hosted model on Daniel's always-on PC. **Recommendation:** keep OpenAI, test Deepgram on the same clips. Do *not* make the shared app depend on a PC in Daniel's home: if it sleeps or reboots, Julien's phone stops working, and the audio would have to leave the private setup to reach it. The PC can still be used for one-off jobs (e.g. re-transcribing an archive).

### D5 — Should the AI know about projects?

- **A. Yes (Kern):** it sees your projects, attaches thoughts to them, proposes new ones; doubtful matches wait for you with a one-tap "create project & link".
- **B. No (Handled):** you attach at review time.
- **Recommendation: A**, after D1 — a doubtful match needs somewhere to wait.

### D6 — Typed text: a thought or a form?

- **A. A thought (Kern):** typed text goes through the same AI filing as voice. "Add a note to this project / person" pre-fills context instead of bypassing the AI.
- **B. A form (Handled):** you fill title, details, category, project, person yourself.
- **Recommendation: A.** Kern's first principle is "the AI files; forms are for correcting, never for creating" and it came from abandoned Notion set-ups.

### D7 — Look and navigation

What actually conflicts:

| | Kern (settled after live iteration) | Handled today |
|---|---|---|
| Home | Today digest | Capture screen |
| Capture | Floating mic + pencil on every screen | Its own tab |
| Tabs | Today · To-dos · Library · Projects | Capture · Timeline · Projects · People |
| Inbox | Badge button; opens over any screen; only what needs review | "Timeline" tab with everything |
| Cards | Checkbox / dot, priority flag, due pill, folder tab for project, **no capture date** | Coloured "Category · Type", status, summary, "Project · date" |
| Styling | Paper look, Montserrat | Indigo brand, system font |

- **A. Kern's navigation and cards, wholesale.** Cost: every list screen redone; Julien's design and the "timeline" framing replaced; People needs a slot.
- **B. Handled's navigation, Kern's card rules where they do not fight it** (priority flag, due pill, folder tab, one label per kind of information); keep capture dates because the tab is called Timeline.
- **C. Kern's navigation with Handled's colours and fonts.**
- **Recommendation: C, in stages.** Kern's navigation came out of daily use; Handled's has not been lived in yet. But start with the cards (no navigation change), then the Today screen and floating capture, then the To-dos / Library tabs. Decide "no capture dates" per screen, not globally. Iterate the cards the way Kern did: look at the running app together and react.

### D8 — The Claude Code brief

- **A. As in Kern:** per project, "Export brief" (everything) and "New only" (since last export); exported knowledge and ideas are marked as shipped and move to the archive; open to-dos stay until done; copy to clipboard.
- **B. Only "Export brief", no shipped-marking.** Cost: "New only" and the shipped/unshipped distinction are lost.
- **C. Drop it.**
- **Recommendation: A**, and decide whether research results belong in the brief (a "Sourced findings" section would be a real benefit of the merge). The button must say "New only", never "delta".

### D9 — Instant capture with background filing

Kern returns "captured" immediately and files a few seconds later; Handled makes you wait. Recommendation: switch to Kern's behaviour **together with** D1 — automatic filing without instant capture gains nothing, and instant capture without automatic filing has nothing to do while you wait. This also unlocks imports from other recorders later.

### D10 — What to do with the features only one app has

Keep everything Handled has (research, meeting briefing, contacts and sending); leave Kern's unbuilt items (Plaud import, push notifications) parked as Kern parked them. Write this into the team CLAUDE.md so it is not re-proposed.

### D11 — Kern's existing data

Kern's knowledge base lives on the Pi with no backup. Decide whether to import it into the merged app (recommended — "New only" briefs and daily resurfacing are pointless on an empty brain) or start clean.

---

## Suggested order of work (functional milestones)

Each step is usable on its own; nothing is half-built in between.

1. **Make the current flow sturdier** — no re-transcribing on retry, transcript kept even if the next step fails. No product change.
2. **Projects become threads** — goal/summary, status, edit, delete. Still attached by hand.
3. **One way to sort thoughts** (D2) — the new types, priority flag, due day, archive; editable after saving.
4. **The AI rewrites under Kern's rules** (D3, D4) — plus a shared set of Dutch/English test thoughts to compare providers. You still review everything.
5. **Cards look like Kern's** (D7, stage 1) — same screens, new rows.
6. **Export a project brief** (D8).
7. **Typed text is a thought** (D6).
8. **Instant capture, background filing, automatic retry** (D9).
9. **The AI is the gate, with undo** (D1) — inbox for doubtful results, "filed today" list. Behind a per-user switch so nobody's flow changes until both opt in.
10. **The AI knows your projects** (D5) — matching, proposed projects, one-tap create & link.
11. **Today screen, floating capture, To-dos / Library tabs** (D7, stages 2–3).
12. **Import Kern's data** (D11). Later: other recorders, notifications.

The order is smallest-risk first: the first five steps change nothing about *who decides*; the product-rule change (step 9) comes only once everything it needs is in place and can be switched on per person.
