---
name: pr
description: Create a GitHub pull request from the current branch (default base main) with the GitHub CLI. Use when asked to create, open or submit a PR / pull request, or on /pr. Optional args: base branch, "draft".
---

# Create a pull request

Repo: `DanielDzamba/my-nx-workspace` on GitHub, default base branch **main**.
PRs are created with the GitHub CLI (`gh`), which is already logged in.

## `gh` on this machine

`gh` was installed via winget. It may be missing from `PATH` in a shell that was open before the install.
If `gh` is not found, call it by its full path:

- PowerShell: `& "C:\Program Files\GitHub CLI\gh.exe" ...`
- Git Bash: `"/c/Program Files/GitHub CLI/gh.exe" ...`

If `gh auth status` says you are not logged in, stop and ask the user to run `gh auth login`
(GitHub.com, HTTPS, web browser). It is interactive, so you cannot run it for them.

## Arguments

- First arg that looks like a branch name: the base branch (default `main`).
- `draft`: create the PR as a draft (`--draft`).

## 1. Check the state

```
gh auth status
git status --short
git rev-parse --abbrev-ref HEAD
git log --oneline <base>..HEAD
git status -sb            # first line shows ahead/behind vs upstream
gh pr list --head <branch> --state open
```

Stop and tell the user if:

- the current branch is the base branch. Offer to create a feature branch first.
- `git log <base>..HEAD` is empty. There is nothing to open a PR for.
- an open PR for this branch already exists. Give its URL, and offer to push new commits to it.

Uncommitted changes: list them and ask whether to commit them into this PR or leave them out.
Do not commit them silently. `.claude/` files count as normal project files.

## 2. Push

If the branch has no upstream or is ahead of it, push:

```
git push -u origin <branch>
```

Never force-push without the user's explicit consent.

## 3. Write the title and description

Read all commits in the PR, not only the last one:

```
git log --format='%h %s%n%b' <base>..HEAD
git diff --stat <base>...HEAD
```

- **Title**: short (under 70 characters), imperative, in English, like the commit subjects in this repo.
  With one commit, its subject is usually the right title.
- **Body** (Markdown, English):

```
## Summary
- <one bullet per meaningful change, grouped by area (app, CI, tooling, editor config)>

## Test plan
- [ ] <how to verify, for example CI passes, `npx nx test java-api`, `GET /hello` returns 200>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Keep the attribution line at the end unless the user or CLAUDE.md says otherwise.

## 4. Create the PR

Write the body to a file in the scratchpad directory. That avoids quoting problems in PowerShell and Bash.

```
gh pr create --base <base> --head <branch> --title "<title>" --body-file <scratchpad>/pr-body.md [--draft]
```

## 5. Report

Give the user the PR URL that `gh` prints, plus a short summary (commits and files).
Optionally check CI with `gh pr checks <number>`, but do not wait on it unless asked.
