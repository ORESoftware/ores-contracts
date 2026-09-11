# ores-contracts — agent notes

This repository implements the shared peer-authority contract pipeline used by fleet `*-interfaces`, `*-orm-core`, `*-lib-core`, client, and server repositories.

- Human-authored TypeSpec and JSON Schema Draft 2020-12 are independent top-level authorities. Never generate one authored authority from the other and commit it as authority.
- Generated schemas, normalized IR, SQL, ORM declarations, and language bindings are comparison/runtime evidence only.
- Cross-runtime parity must fail closed through `ORESoftware/typespec-json-schema-validator` (TJSV) as well as this repository's own deterministic IR/emitter checks.
- Preserve stable wire names, enum values, SQL semantics, and compatibility surfaces. A mismatch is a finding to resolve semantically, not a reason to choose one lane as canonical.
- Generated output belongs only in documented generated directories and must be reproducible from reviewed authored inputs.

<!-- BEGIN ores-agents-pointer: managed by ORESoftware/my-ai; edit there, not here -->

## Canonical agent instructions

Before doing anything else in this repository, also read:

    .ores/agents/AGENTS.md

That path is a symlink to `~/codes/oresoftware/my-ai/AGENTS.md`, whose canonical copy is
<https://github.com/ORESoftware/my-ai/blob/main/AGENTS.md>.

It exists at a fixed path *inside* the repository because some agents cannot walk up past
the repository root, so machine-wide instructions one or more directories above are
invisible to them. This pointer plus that path make the same file reachable from a working
directory anywhere in the tree.

The symlink is deliberately **not committed**: it names an absolute path that is only valid
on a machine with `~/codes/oresoftware/my-ai` checked out, so committing it would produce a
broken link for everyone else and for CI. `.ores/` is git-ignored for that reason. If
`.ores/agents/AGENTS.md` is missing on your machine, create it with:

    mkdir -p .ores/agents
    ln -sfn "$HOME/codes/oresoftware/my-ai/AGENTS.md" .ores/agents/AGENTS.md

or run `~/codes/oresoftware/my-ai/scripts/link-repo-agents.sh` once to do it for every git
repository under `~/codes`, and `--check` to verify them.

A missing `.ores/agents/AGENTS.md` is a setup gap on the reader's machine, never a reason to
skip the canonical instructions: fetch them from the URL above instead.

<!-- END ores-agents-pointer -->
