# Project board

Issue status lives on the `voice app` GitHub project board (project number **3**, owner `DannyJulien`). There is no status label — the board is the single source of truth.

Columns: **Backlog** → **In progress** → **Done**.

## What is automatic

The board's own workflows handle everything except one transition. Do not duplicate these by hand:

| Event               | Result                        |
| ------------------- | ----------------------------- |
| Issue created       | Added to the board as Backlog |
| Issue closed        | Moved to Done                 |
| Pull request merged | Moved to Done                 |

Because these fire on GitHub events, they work no matter who acts — a person in the web UI, VS Code, or a coding agent.

## What is manual

**Moving an issue to In progress.** No workflow can detect that someone started thinking about an issue, so whoever claims it sets this. Per the working agreement in `CLAUDE.md`, claiming means both:

```bash
gh issue edit <N> --add-assignee @me
```

...and setting the board status, which needs the four IDs the Projects v2 API works in:

```bash
PID=$(gh project view 3 --owner DannyJulien --format json -q .id)
FIELD=$(gh project field-list 3 --owner DannyJulien --format json \
  -q '.fields[] | select(.name=="Status") | .id')
OPT=$(gh project field-list 3 --owner DannyJulien --format json \
  -q '.fields[] | select(.name=="Status") | .options[] | select(.name=="In progress") | .id')
ITEM=$(gh project item-list 3 --owner DannyJulien --limit 100 --format json \
  -q '.items[] | select(.content.number==<N>) | .id')

gh project item-edit --id "$ITEM" --project-id "$PID" \
  --field-id "$FIELD" --single-select-option-id "$OPT"
```

Verify:

```bash
gh project item-list 3 --owner DannyJulien --limit 100 --format json \
  -q '.items[] | select(.content.number==<N>) | "\(.content.number) | \(.status)"'
```

## Required token scope

`gh` needs the `project` scope; `repo` alone is not enough and every board call fails with `INSUFFICIENT_SCOPES`. Add it once per machine, in a real terminal because it uses a device-code flow:

```bash
gh auth refresh -h github.com -s project
```

Check with `gh auth status` — the scope list must include `project`.

## Useful queries

```bash
# everything on the board with its status
gh project item-list 3 --owner DannyJulien --limit 100 --format json \
  -q '.items[] | "\(.content.number // "-") | \(.status // "NO STATUS") | \(.content.title // .title)"'

# status spread
gh project item-list 3 --owner DannyJulien --limit 100 --format json \
  -q '.items[].status // "NO STATUS"' | sort | uniq -c
```
