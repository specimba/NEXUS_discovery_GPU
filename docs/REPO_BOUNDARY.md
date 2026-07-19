# Repo boundary — do not mix

| Repo | Purpose |
|------|---------|
| **https://github.com/specimba/NEXUS_discovery_GPU** | Intern / Discovery A100 session backups, GPU experiments, JuiceFS workspace proofs |
| **Local `Documents/NEXUS`** (nexusalpha / NEXUS-A2A-OS / CODEX branches) | NEXUS OS product, agents, desktop — **not** the Discovery GPU session dump target |

On A100 machine:
```
/data/NEXUS/git_backups/work  →  clone of NEXUS_discovery_GPU
/data/NEXUS/workspace         →  live session files
```

Push discovery progress **here only**. Do not dump A100 session tars into the OS monorepo.
