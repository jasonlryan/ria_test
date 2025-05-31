# Repo Guidelines for Automated Agents

This repository uses `.cursor/rules` for detailed development standards. Agents should follow these high-level instructions:

## Testing and Linting
- Always run `npm run lint` and `npm run test:unit` before committing changes.
- Tests under `tests/` rely on environment variables defined in `env.md` or `.env`. If API keys or network access are unavailable, note this in test results.

## Documentation
- Follow `.cursor/rules/documentation-timestamp.mdc` for timestamps.
- Include `**Last Updated:** <date>` at the top and `_Last updated: <date>_` at the end. Use the `date` command to generate the timestamp.

## Focus and Architecture
- Follow the focus rules in `.cursor/rules/focus-guideline.mdc`: implement only what is requested.
- Maintain the controller-service architecture as described in `.cursor/rules/controller-service-architecture.mdc`.

