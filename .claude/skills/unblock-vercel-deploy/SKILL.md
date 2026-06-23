---
name: unblock-vercel-deploy
description: Unblock a Vercel production deploy that is stuck in the BLOCKED state because the tip commit on the production branch was authored by a GitHub account that is not a member of the Vercel project (e.g. a collaborator like Zach). Diagnoses the block, then puts an owner-authored empty commit on top of the branch and pushes so the production build is allowed through. Use when Vercel deployments show "Blocked", a push isn't going live, or someone says "my deploy is blocked / won't deploy to prod".
---

# Unblock a Vercel deployment blocked by commit author

## What this fixes

Vercel sets a deployment to `state: BLOCKED` when the git commit author is a
GitHub account that isn't a recognized member of the Vercel project. This is a
security gate against collaborators auto-deploying to production. The deployment
isn't failing to build — it's never allowed to start. Re-triggering the same
commit just produces another BLOCKED deployment.

The fix: add an **empty commit authored by the project owner** on top of the
production branch and push. The new HEAD is authored by a trusted account, so
the production build runs. This does not rewrite history, does not force-push,
and adds no file changes.

This skill runs **fully automatically** — it diagnoses, commits, pushes, and
reports the live deployment without pausing for confirmation.

## When NOT to use it (stop and report instead)

- The blocked deployment's commit author **is** the owner. Then the block has a
  different cause (spend limit, paused project, build error) and re-authoring
  won't help — report the real cause.
- The most recent production deployment is already `READY` — nothing to do.

## Steps

1. **Load project identifiers.** Read `.vercel/project.json` in the repo root:
   - `projectId` → `projectId`
   - `orgId` → `teamId`
   If the file is missing, the repo isn't linked to Vercel — stop and say so.

2. **Determine the trusted owner email.** Run `git config user.email`. Cross-check
   it against `creator.email` on a recent `READY` deployment (step 3) — they
   should match. This is the author that Vercel trusts.

3. **Fetch deployments** with `mcp__plugin_vercel_vercel__list_deployments`
   (`projectId`, `teamId`). Look at the most recent `target: production`
   deployment:
   - If its `state` is `READY` → already live, stop and report. Nothing to do.
   - If its `state` is `BLOCKED` → read `meta.githubCommitAuthorEmail`.
     - If it **equals** the trusted owner email → different root cause, stop and
       report (see "When NOT to use it").
     - If it **differs** → confirmed: blocked by a non-owner commit author.
       Continue.

4. **Sync the production branch.** The production branch is the blocked
   deployment's `meta.githubCommitRef` (usually `main`).
   - `git fetch origin --quiet`
   - Check out that branch if not already on it.
   - If local is behind `origin/<branch>`, fast-forward (`git pull --ff-only`).
     Never force-push or rewrite history.

5. **Create the owner-authored empty commit.** The author comes from local git
   config (verified in step 2 to be the owner):
   ```
   git commit --allow-empty -m "Re-author deploy to unblock Vercel (non-owner commit author)

   The previous tip of <branch> was authored by a GitHub account that isn't a
   member of the Vercel project, so Vercel blocked the production build. This
   owner-authored commit lets it through. No file changes.

   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
   ```
   Confirm the new HEAD author is the owner: `git log -1 --pretty='%h %an <%ae>'`.

6. **Push** to the production branch: `git push origin <branch>`. This is a
   fast-forward (the empty commit sits on top of the old tip), so no force flag.

7. **Confirm the new deployment isn't blocked.** Call `list_deployments` again
   (pass `since` = just before the push as a ms timestamp) and find the
   deployment whose `meta.githubCommitSha` matches the new HEAD. Verify its
   `state` is `BUILDING`/`QUEUED` (i.e. NOT `BLOCKED`) and `creator.email` /
   `meta.githubCommitAuthorEmail` is the owner.

8. **Wait for it to go live.** Poll `list_deployments` until the new deployment
   reaches `READY` (or `ERROR`/`CANCELED`). Report the final `state`, the
   `inspectorUrl`, and the production URL.

## Report at the end

- The diagnosis (who authored the blocked commit vs the trusted owner).
- The new commit SHA and that it's owner-authored, empty, no force-push.
- The final deployment state + inspector/production URLs.
- A one-line reminder that this recurs whenever the production branch tip is
  authored by a non-member, and the permanent fix is to add that GitHub account
  to the Vercel project or adjust **Settings → Git** deployment authorization.

## Notes

- Tool schemas for the Vercel MCP are deferred. Load them first with ToolSearch:
  `select:mcp__plugin_vercel_vercel__list_deployments`.
- The `get_deployment` MCP tool sometimes returns a "Response validation failed"
  error; `list_deployments` carries everything needed (state, author, URLs), so
  rely on it.
