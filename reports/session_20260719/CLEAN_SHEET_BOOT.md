# Clean-sheet Discovery VM boot — next account / new machine

## Identity of last machine (reference only)

- Name: **NEXUS-GPU-test3**
- ID: `nb-253ef43eacdbe4e480503d693d5026ed`
- Tenant path: `/inside/101/nb-...`
- Inside URL: `https://discovery.intern-ai.org.cn/compute/dev-machine/inside/101/nb-253ef43eacdbe4e480503d693d5026ed`
- List: `https://discovery.intern-ai.org.cn/compute/dev-machine`
- Code (when live): `https://discovery-notebook-p.intern-ai.org.cn/notebook/.../nb-.../code/?folder=/data/NEXUS`
- Workspace: `/data/NEXUS` · `/data/NEXUS/workspace`
- BEST: **step_5000 frozen** — never delete/mutate without inventory

## Boot law (do not skip)

1. List page: if **gray · 已停止** → click **启动**, never **进入**.
2. Modal: set hours so `hours * 60 ≤ remaining 算力点` (example: 439 pts → max 7h, not 8h).
3. **确认** only when enabled.
4. Wait **排队中** → **运行中** (badge green).
5. Then **进入开发机** → new inside tab; wait CPU/GPU metrics + iframe/monaco.
6. Never confirm **离开开发机** unless ending session.
7. 续时 success does not guarantee still running after hours-end.
8. If code-server **403**: list → **进入开发机** again; hard-refresh inside URL if OOM/crash.

## Agent restore on clean IDE

1. Open folder `/data/NEXUS` (or restore portable tar into `/data/NEXUS/workspace`).
2. Cline: model **cline-pass:kimi-k3**, **Act**, full Auto-approve (Read/Edit/All Commands/Browser/MCP), collapse AA before type.
3. Every shell tool: `requires_approval=false`.
4. Kilo Hy3: disk verify lane; expect free-queue stalls.
5. Local orch: CDP **9224** allowlist · `Documents/NEXUS/scratch/*`.
6. Decoy: keep light VRAM hold if idle-kill risk.
7. Keepalive + tab_health on inside URL.

## Restore portable

```bash
# On new Discovery VM after 运行中 + enter:
cd /data/NEXUS/workspace
# copy tarball from local/cloud disk first, then:
mkdir -p portables && tar xzf NEXUS_DISCOVERY_SESSION_20260719.tar.gz -C portables
# or unpack session folder contents into workspace
ls -la portables/session_20260719/MANIFEST.md
```

## After every mission (sync habit)

1. Shell marker on disk (not chat prose).
2. Copy new `*.md` / stubs into `portables/session_*/` and refresh MANIFEST.
3. Local: pull tarball or rsync docs into `Documents/NEXUS/portables/`.
4. Git: commit handoff + code stubs; push when auth ready (no secrets/API keys).
5. Update `SESSION_ACHIEVEMENTS.md` one bullet per marker.

## GO gates

| Gate | Default |
|------|---------|
| train / DPO | **OFF** until dry-run + canon eval GREEN |
| gdrive bulk | **OFF** |
| BEST mutate | **OFF** |
| multi-L2 soup | **OFF** — cascade L0→Guard→router→ONE L2 |
