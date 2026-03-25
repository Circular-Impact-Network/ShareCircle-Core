# ShareCircle

**ShareCircle** is a digital sharing platform built under the Circular Impact Network initiative. It enables communities to share, borrow, and repurpose items with ease.

## Core Features

- Group-based material sharing (Share Groups)
- Smart item cataloging with images & metadata
- Borrow/Reserve/Return workflows with reminders
- Ratings for lenders and borrowers
- AI-powered redistribution (Facebook Marketplace etc.)

## Guiding Principles

- **Convenience** is key – If it's not easy, it won't scale
- Use **accessible technology** – Low-barrier tools that work on basic devices.
- Encourage **continuous improvement** – Test fast, learn, and adapt.
- Design for **flexible sharing models** – Support both structured and free-form sharing
- Community-driven – Solutions must empower local groups and individual agency.
- Minimal infrastructure dependency – Avoid models that need lockers, staff, or physical inventory.

## Structure

- `core/`: Open-source base
- `pro/`: Advanced features (optional commercial license)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Claude Code Setup

This repository includes comprehensive Claude Code configuration for AI-assisted development.

### Quick Start

1. Ensure you have [Claude Code](https://code.claude.com/) installed
2. The project guide is in [CLAUDE.md](CLAUDE.md) - Claude will automatically reference it
3. Recommended skills are listed in [CLAUDE.md](CLAUDE.md) - install via `/install <skill-name>`
4. Permissions and hooks are configured in [.claude/settings.local.json](.claude/settings.local.json)

### What's Configured

- **[CLAUDE.md](CLAUDE.md)**: Complete project guide (architecture, patterns, gotchas)
- **Skills**: UI/UX, frontend design, React best practices, code review
- **Hooks**: Auto-lint and format check before commits
- **Permissions**: Pre-approved commands for linting, testing, database

See [CLAUDE.md](CLAUDE.md) for full details on project architecture and development patterns.

## Licensing

Dual-licensed under MIT and GPL-3. See `LICENSE` for details.

## How to Contribute

Please read `CONTRIBUTE.MD`.
