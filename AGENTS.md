# Agent Instructions

## Commit guidelines

- Use short commit messages in sentence case (only the first word capitalized).
- Keep commit messages to 7 words or fewer.
- Do not use Conventional Commits prefixes (e.g. `feat:`, `fix:`).
- When changes include multiple independent changes, create separate commits for each feature or bugfix.

## TDD workflow

- For every code change, add a generic test, make sure it fails first, then implement the code and make sure it passes.

## Command approval policy

- Assume approved prefixes (`git`, `npm`, `npx`) should be sufficient for normal work.
- Do not request escalated permissions unless a required command fails in sandbox first.
- Avoid shell forms that bypass prefix-rule matching:
  - no pipes (`|`)
  - no command chaining (`&&`, `||`, `;`)
  - no command substitution (`$()`)
  - no redirection (`>`, `>>`, `<`)
  - no heredoc/herestring (`<<`, `<<<`)
- Prefer direct one-command invocations so persistent prefix approvals apply across new chats.
