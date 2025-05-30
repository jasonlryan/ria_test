# Guidelines for Codex Agents

This repository uses Node.js with TypeScript and Vitest for testing.

## Setup
- Use Node.js v18 or later.
- Run `npm install` after cloning to install dependencies.

## Development
- Application code lives under `app/` and `components/`.
- Unit tests are located in the `tests/` directory and executed with Vitest.
- Before committing changes, run `npm test` to ensure all tests pass.
- Run `npm run lint` (and `npm run lint:css` for styles) to check for lint errors.

## Contributions
- Add tests alongside new features or bug fixes.
- Keep commit messages concise and descriptive.
