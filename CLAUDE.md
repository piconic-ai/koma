## Git Commit

Every commit MUST end with `Co-authored-by:` trailers for **all** participants other than the git author. Place them as the final lines of the message — no blank line or trailing content after them, otherwise GitHub will not recognize them.

List one line per participant, in this order:

1. **The implementer** — the AI that wrote the code (you). Use your model name from the system prompt.
   Example: `Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>`
2. **Other collaborators** — any other AI that directed, reviewed, or co-implemented the change in this session, and any human collaborator who is not the git author. One trailer per participant.

Never skip step 1, regardless of environment (local, Web, IDE). If you cannot identify your model name from the system prompt, ask the user before committing rather than omitting the trailer.

When `CLAUDE_CODE_ENTRYPOINT=remote` (Claude Code Web), the git author is `Claude` by default. Before the first commit of the session, run `git log --format='%an <%ae>' | grep -v '^Claude ' | sort -u` and let the user pick the human identity via `AskUserQuestion`. Remember the choice for the session and add that human as a co-author on every commit.

