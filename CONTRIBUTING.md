# Contributing

Thanks for helping improve NEXUS.

## Setup

```bash
git clone https://github.com/Nikhil-creat/nexus-ai-platform.git
cd nexus-ai-platform
cd frontend && npm install && npm run dev
```

Backend tests:

```bash
pip install fastapi pyjwt pyyaml pytest
cd backend && python -m pytest -q tests
```

## Workflow

1. Fork the repo and create a branch: `git checkout -b feat/short-name`.
2. Keep changes focused. Add or update tests for backend logic.
3. Before opening a PR run `npm run typecheck` in `frontend/` and the pytest command above.
4. Open a pull request using the template and describe what changed and why.

## Style

- TypeScript strict mode, no `any` unless a library forces it.
- Python 3.12 with type hints.
- Sharp-edged, monochrome UI that matches the existing design tokens in `globals.css`.
- Anything that can delete, update, migrate or call a webhook must go through the approval gate.

## Commit messages

Use short imperative subjects, for example `Add OIDC login` or `Fix audit chain verify`.
