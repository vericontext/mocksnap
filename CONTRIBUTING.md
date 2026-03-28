# Contributing to MockSnap

Thanks for your interest in contributing to MockSnap! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/vericontext/mocksnap.git
cd mocksnap
pnpm install
pnpm dev
```

- Web UI: http://localhost:3000
- API: http://localhost:3001

## Project Structure

- `apps/api` — Hono backend (port 3001)
- `apps/web` — Next.js 15 frontend (port 3000)
- `packages/shared` — Shared TypeScript types

## Code Conventions

- TypeScript strict mode, ESM imports
- Backend imports must include `.js` extension (ESM rule)
- Frontend components use `'use client'` directive
- Tailwind CSS utility classes only (no separate CSS files)
- Support both light and dark mode (`dark:` variants)

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Test locally with `pnpm dev`
4. Submit a PR with a clear description of what changed and why

## Reporting Issues

Open an issue on GitHub with:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
