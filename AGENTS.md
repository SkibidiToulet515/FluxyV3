# Agent workflow

After **any meaningful code or config change** requested by the user:

1. Commit with a clear message (`git add` → `git commit`).
2. Push to the remote (`git push`).
3. Deploy hosting: from repo root, `npm run deploy:hosting` (builds `Client/` and runs `firebase deploy --only hosting`).

Skip if there is nothing to commit, or the task was questions-only with no edits. If deploy cannot run, note it after commit/push.

Details and edge cases: `.cursor/rules/git-commit-after-task.mdc` (always applied in Cursor).
