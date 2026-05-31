# AGENTS.md — Kōda Agent System

Vsak agent ima svojo vlogo. Nikoli ne dela izven svojega področja.
Vse berejo CLAUDE.md najprej. Potem svojo AGENT datoteko.

---

## KAK UPORABIŠ AGENTA

V Claude Code:
```
Read CLAUDE.md and docs/agents/AGENT-[ime].md, then [task].
```

---

## SEZNAM AGENTOV

| Agent | Datoteka | Naloga |
|---|---|---|
| Dev | AGENT-DEV.md | Gradi nove funkcije |
| Test | AGENT-TEST.md | Piše in zaganja teste |
| Deploy | AGENT-DEPLOY.md | Docker, env, deployment |
| DB | AGENT-DB.md | Migracije, schema, RLS |
| Review | AGENT-REVIEW.md | Code review, quality check |
| Debug | AGENT-DEBUG.md | Išče in popravlja bugi |
| Docs | AGENT-DOCS.md | Posodablja dokumentacijo |
EOF