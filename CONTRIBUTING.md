# Contributing

Thanks for your interest in contributing! Every contribution helps—whether it's a bug fix, new feature, documentation improvement, or even just opening an issue to share feedback.

## Getting Started

```bash
git clone https://github.com/tyler-g/multipart-uploader.git
cd multipart-uploader
npm install
```

## Development Workflow

**Build**

```bash
npm run build
```

**Test**

```bash
npm test
```

Run the test UI for debugging: `npm run test:ui`

**Lint**

```bash
npm run lint          # Check
npm run lint:fix      # Auto-fix
```

**Type check**

```bash
npm run type-check
```

All of these commands must pass before merging. CI runs the same checks on pull requests.

## Submitting Changes

1. **Fork** the repo and create a branch from `main`
2. Make your changes
3. Ensure `npm run build`, `npm test`, and `npm run lint` all pass
4. **Open a PR** with a clear description of what changed and why
5. Address any review feedback

## What to Contribute

- **Bug reports** – Found something broken? Open an issue with steps to reproduce
- **Feature ideas** – Have an idea? Open an issue to discuss before building
- **Code changes** – Fix bugs, add features, improve types, or refactor
- **Documentation** – Fix typos, clarify examples, or add usage guides to the wiki
- **Tests** – More test coverage is always welcome

## Code Standards

- TypeScript with strict mode
- ESLint + Prettier (config included)
- Follow existing patterns in the codebase
- Prefer small, focused PRs

## Questions?

Open an issue—we're happy to help. Happy contributing!
