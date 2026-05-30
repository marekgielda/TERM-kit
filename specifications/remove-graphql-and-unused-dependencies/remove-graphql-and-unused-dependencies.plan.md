# remove-graphql-and-unused-dependencies - Implementation Plan

## Task Details

| Field            | Value |
| ---------------- | ----- |
| Jira ID          | N/A |
| Title            | Remove GraphQL and its unused dependencies |
| Description      | Remove GraphQL support from the boilerplate, including runtime wiring, generated/source GraphQL assets, scaffolding, documentation, and only the npm dependencies that are not used elsewhere. Do not add tests. |
| Priority         | Medium |
| Related Research | None - no `.research.md` file exists for this task |

## Proposed Solution

Remove GraphQL as an optional integration from the boilerplate rather than replacing it with a new abstraction. The implementation should strip Apollo Server bootstrapping from the Express app, remove the GraphQL dependency registration from the Awilix container, update production packaging so the image no longer expects `/app/graphql`, delete GraphQL-only source and generated files, remove GraphQL scaffolding from Plop, and clean the package manifest and lockfile so only non-shared GraphQL dependencies and packages that become unused solely because of GraphQL removal are dropped.

The existing REST, CQRS, DI, Swagger, and database setup should remain unchanged. The example feature's commands, queries, handlers, actions, and entities stay in place; only its GraphQL adapter files should be removed. Repository-level cleanup must explicitly cover stale GraphQL references in documentation, developer instructions, and ignore files so the boilerplate no longer advertises unsupported GraphQL flows or `generate-schema` usage.

```mermaid
flowchart LR
    Client --> ExpressApp
    ExpressApp --> Health[/health]
    ExpressApp --> Docs[/api-docs]
    ExpressApp --> Rest[/api]
    Rest --> Routing
    Routing --> Actions
    Actions --> Buses[CommandBus / QueryBus]
    Buses --> Handlers
    ExpressApp -. removed .-> GraphQL[/graphql via ApolloServer]
```

## Current Implementation Analysis

### Already Implemented

List of existing components, functions, utilities that will be reused (with file paths):

- `createApp` - `src/app/app.ts` - Express application bootstrap already supports REST endpoints, health checks, Swagger, and centralized error handling; GraphQL is an additive integration.
- `createContainer` - `src/container.ts` - Central Awilix registration order makes GraphQL removable as a separate registration step.
- Feature CQRS flow - `src/app/features/example/commands`, `src/app/features/example/queries`, `src/app/features/example/handlers`, `src/app/features/example/query-handlers`, `src/app/features/example/actions` - Domain logic and REST adapters already exist independently from GraphQL.
- REST-oriented Plop generators - `plopfile.js`, `plop-templates/action.ts`, `plop-templates/query/*`, `plop-templates/command.ts`, `plop-templates/crud/*` - Boilerplate scaffolding already supports non-GraphQL feature development and should remain.
- Quality and build scripts - `package.json` - Existing `lint`, `format`, `build`, `integration`, and `units` scripts provide validation paths; this task should rely on static validation only and not add tests.

### To Be Modified

List of existing code that needs changes or extensions (with file paths and description of changes):

- `createApp` - `src/app/app.ts` - Remove Apollo imports, GraphQL-specific dependency fields, `/graphql` middleware, and any no-longer-used request parsing or bus injections.
- `createContainer` - `src/container.ts` - Remove the GraphQL container import and registration call while preserving the remaining bootstrap order.
- `docker/prod/Dockerfile` - Stop copying `/app/graphql` into the production image before GraphQL assets are deleted so production packaging remains valid after the cleanup.
- GraphQL registration module - `src/container/graphql.ts` - Delete the dedicated registration module once container wiring is removed.
- GraphQL source and generated assets - `graphql/schema.gql`, `src/graphql/resolvers/index.ts`, `src/graphql/types/index.ts`, `src/app/features/example/graphql/**` - Delete GraphQL-only schema, resolver, generated types, and example adapter files.
- GraphQL code generation config - `codegen.yml` - Delete the now-unused codegen configuration.
- Package manifest and lockfile - `package.json`, `package-lock.json` - Remove the `generate-schema` script and only the direct GraphQL/Apollo/codegen dependencies that are not used by anything else; refresh the lockfile accordingly.
- Plop scaffolding - `plopfile.js`, `plop-templates/graphql/query.ts`, `plop-templates/graphql/mutation.ts` - Remove GraphQL generators, resolver mutation helpers, and GraphQL-specific templates.
- Repository documentation and metadata - `README.md`, `docs/*.md` files that still reference GraphQL, `.github/copilot-instructions.md`, `.eslintignore`, `.prettierignore` - Remove or rewrite stale GraphQL references so the repo documents and configures only supported flows.

### To Be Created

List of new components, functions, utilities that need to be built from scratch:

- None. This is a removal and cleanup task.

## Open Questions

| #   | Question | Answer | Status |
| --- | -------- | ------ | ------ |
| 1   | Should this task add or expand tests? | No. The user explicitly requested not to add tests. Validation should use existing static checks and targeted searches only. | ✅ Resolved |
| 2   | Should GraphQL-specific documentation and scaffolding be removed in addition to runtime code? | Yes. They are isolated boilerplate integration points and would otherwise leave stale instructions and generators behind. | ✅ Resolved |
| 3   | Are the identified GraphQL dependencies shared by non-GraphQL runtime code? | Current repository searches show GraphQL usage confined to Apollo runtime wiring, codegen, generated types, example GraphQL adapters, and docs/scaffolding. | ✅ Resolved |

## Technical Context

Project conventions, coding standards, and patterns discovered during planning. Downstream agents MUST read this section instead of re-discovering the same context.

### Project Instructions

- `.github/copilot-instructions.md` - Repository is a Node.js + TypeScript boilerplate using feature-based organization, CQRS, Awilix DI, TypeORM, REST endpoints, and Docker-based workflows. Use kebab-case for files and directories, camelCase for functions, PascalCase for classes. Make minimal, manual changes instead of using Plop for implementation work.
- `.github/instructions/quality.instructions.md` - Relevant quality commands are `npm run lint`, `npm run format`, `npm run build`, `npm run integration`, and `npm run units`. TypeScript is strict, double quotes are required, and unused variables/imports must be removed.
- `.github/instructions/error-handling.instructions.md` - Error handling is centralized through `src/middleware/error-handler.ts`; actions and handlers should continue to throw errors rather than handling them inline. This task should not alter that flow.
- `.github/instructions/security.instructions.md` - `src/app/app.ts` already applies Helmet, CORS, and request validation conventions. Removing GraphQL must preserve the existing REST middleware order and not broaden public access.

### Architecture & Patterns

- This is a single backend repository. The main application lives under `src/` and follows a feature-based structure in `src/app/features`.
- Request handling uses CQRS: REST `actions` delegate to `CommandBus` or `QueryBus`, which invoke handlers registered through Awilix.
- The DI bootstrap is centralized in `src/container.ts`, with separate registration modules for common services, routing, handlers, subscribers, database access, and currently GraphQL.
- `src/app/app.ts` constructs the Express app, mounts `/health`, `/api-docs`, and `/api`, then attaches the global not-found and error handlers.
- GraphQL is not part of the core domain model. It is currently an isolated integration composed of `src/container/graphql.ts`, `graphql/schema.gql`, `src/graphql/*`, and adapter files under `src/app/features/example/graphql/`.
- Plop modifies central registration files via marker comments. GraphQL-specific generator actions currently target `src/graphql/resolvers/index.ts` and feature-local `graphql/queries` / `graphql/mutations` folders.
- `docker/prod/Dockerfile` currently copies `/app/graphql` from the build stage into the runtime image, so packaging cleanup must happen before or together with deletion of repository GraphQL assets.

### Tech Stack

- Runtime: Node `20`, TypeScript `5.4.5`, Express `4.19.2`, Awilix `10.0.2`, TypeORM `0.3.20`, Helmet `7.1.0`, CORS `2.8.5`, Celebrate `15.0.3`, Swagger UI.
- CQRS/Eventing: `@tshio/command-bus`, `@tshio/query-bus`, `@tshio/event-dispatcher`, `@tshio/awilix-resolver`, `@tshio/logger`.
- GraphQL dependencies currently present in `package.json`: `@apollo/server`, `graphql`, `@graphql-codegen/cli`, `@graphql-codegen/typescript`, `@graphql-codegen/typescript-resolvers`.
- Tooling: npm with a committed `package-lock.json`, ESLint, Prettier, SWC, Mocha, Chai, Supertest, Husky, Docker Compose.

### Code Style & Standards

- Use ASCII and preserve the existing style of touched files.
- Keep changes minimal and focused on the GraphQL removal scope; do not refactor unrelated code.
- Remove any imports, dependency fields, helper constants, and scripts that become unused after GraphQL cleanup.
- Preserve existing public REST behavior, especially `/api`, `/api-docs`, `/health`, middleware ordering, and container registration patterns.
- File names remain kebab-case. Deletions should favor removing whole GraphQL-specific files instead of leaving dead placeholders.

### Testing Patterns

- Test stack: Mocha + Chai + Supertest, with `.spec.ts` naming.
- Existing validation commands: `npm run lint`, `npm run build`, `npm run integration`, `npm run units`.
- This task must not add tests. The appropriate verification focus is static validation and targeted repository searches after cleanup.

### Database Patterns

- Database access uses TypeORM repositories registered in `src/container/database.ts`.
- Migrations live in `src/migrations` and are auto-run at application start.
- This task does not involve schema, entity, repository, or migration changes.

### Additional Context

- `codegen.yml` exists solely to generate `src/graphql/types/index.ts` from `graphql/schema.gql`; once GraphQL is removed, both files can be deleted.
- The only feature-local GraphQL source found is the example feature in `src/app/features/example/graphql/`; its underlying commands, queries, and handlers are reusable and should remain.
- Documentation still advertises GraphQL in the README and multiple `docs/` pages. `docs/12-splitting-up-graphql-schema-to-separate-files.md` is entirely GraphQL-specific and is a strong deletion candidate rather than a rewrite.
- `package-lock.json` will need to be refreshed after manifest changes so direct and transitive GraphQL packages are removed consistently.

## Implementation Plan

### Phase 1: Remove Runtime GraphQL Integration

#### Task 1.1 - [MODIFY] Simplify Express app bootstrap to REST-only

**Description**: Update `src/app/app.ts` to remove Apollo Server, the `/graphql` middleware, and GraphQL-only dependency fields while preserving the existing REST endpoints, Swagger setup, health check, and error handling flow.

**Definition of Done**:

- [x] `src/app/app.ts` no longer imports `@apollo/server`, Apollo plugins, `@apollo/server/express4`, `body-parser`, or any GraphQL-only types.
- [x] `AppDependencies` no longer requires `graphQLSchema`, `resolvers`, `commandBus`, or `queryBus` solely for GraphQL context wiring.
- [x] The Express app still mounts `/health`, `/api-docs`, `/api`, the not-found handler, and the global error handler in the same order.

#### Task 1.2 - [MODIFY] Remove GraphQL registration from container bootstrap

**Description**: Update `src/container.ts` so the Awilix bootstrap no longer imports or invokes the dedicated GraphQL registration module, while keeping the remaining registration order intact.

**Definition of Done**:

- [x] `src/container.ts` no longer imports `registerGraphQLDependencies`.
- [x] The container bootstrap no longer calls a GraphQL registration step.
- [x] Existing app and server registration continue to resolve without GraphQL cradle dependencies.

#### Task 1.3 - [MODIFY] Remove GraphQL production image packaging

**Description**: Update `docker/prod/Dockerfile` so the production image no longer copies `/app/graphql`. This must be completed before or alongside deletion of GraphQL assets to avoid breaking production packaging.

**Definition of Done**:

- [x] `docker/prod/Dockerfile` no longer contains `COPY --chown=node:node --from=build /app/graphql /app/graphql`.
- [x] The remaining production image copies still cover the runtime assets required by the REST-only application.
- [x] The plan treats Docker packaging cleanup as part of the same removal scope, not as follow-up work.

### Phase 2: Remove GraphQL Source Artifacts

#### Task 2.1 - [MODIFY] Delete repository GraphQL schema, resolvers, generated types, and example adapters

**Description**: Remove the GraphQL-only source tree and generated artifacts from the repository, including the top-level schema, resolver/type files, and the example feature's GraphQL adapters.

**Definition of Done**:

- [x] `graphql/schema.gql` is removed.
- [x] `src/graphql/resolvers/index.ts` and `src/graphql/types/index.ts` are removed.
- [x] `src/app/features/example/graphql/queries/users.query.ts` and `src/app/features/example/graphql/mutations/delete-user.mutation.ts` are removed.
- [x] No remaining source imports reference the deleted GraphQL files.

#### Task 2.2 - [REUSE] Preserve existing REST and CQRS example behavior

**Description**: Keep the example feature's commands, queries, handlers, entities, routing, and REST actions intact so the cleanup only removes GraphQL adapters, not shared domain or REST behavior.

**Definition of Done**:

- [x] Example feature files outside `src/app/features/example/graphql/` remain unchanged unless a direct import cleanup is required.
- [x] Command/query bus usage for REST actions is still wired through the existing handlers and routing.
- [x] The implementation does not replace GraphQL with any new abstraction or duplicate existing REST logic.

### Phase 3: Remove GraphQL Scaffolding and Dependencies

#### Task 3.1 - [MODIFY] Remove GraphQL generators and templates from Plop

**Description**: Update `plopfile.js` to stop generating GraphQL code and remove GraphQL-specific helper actions that mutate the deleted resolver registry. Delete the unused GraphQL template files as part of the same cleanup.

**Definition of Done**:

- [x] `plopfile.js` no longer declares GraphQL generator actions, GraphQL resolver update helpers, or generator registrations such as `graphql+query+handler`, `graphql+command+handler`, `graphql-query`, and `graphql-mutation`.
- [x] `plopfile.js` no longer references `src/graphql/resolvers/index.ts`.
- [x] `plop-templates/graphql/query.ts` and `plop-templates/graphql/mutation.ts` are removed.
- [x] Remaining Plop generators for features, REST actions, commands, queries, models, CRUD, and events still describe valid repository structure.

#### Task 3.2 - [MODIFY] Remove GraphQL codegen config and now-unused package dependencies

**Description**: Clean the package manifest and lockfile so only GraphQL-specific direct dependencies, the `generate-schema` script, and any packages that become unused solely because GraphQL support was removed are deleted. Delete the standalone codegen configuration once nothing consumes it.

**Definition of Done**:

- [x] `package.json` no longer contains the `generate-schema` script.
- [x] `package.json` no longer lists direct dependencies/devDependencies that are only needed for GraphQL or GraphQL code generation.
- [x] Any additional package removed from `package.json` or `package-lock.json` is justified by repository usage showing it is not used outside the deleted GraphQL path.
- [x] `codegen.yml` is removed.
- [x] `package-lock.json` is regenerated or updated so removed manifest entries and their orphaned transitive packages are no longer locked.
- [x] No non-GraphQL dependency is removed unless repository usage proves it is also unused.

### Phase 4: Update Documentation and Run Static Verification

#### Task 4.1 - [MODIFY] Rewrite repository documentation and metadata to reflect REST-only support

**Description**: Update repository documentation and top-level metadata so they no longer promise GraphQL support, GraphQL generators, or schema/codegen workflows. Delete GraphQL-only documentation that no longer has a supported counterpart, and remove stale GraphQL ignore/instruction entries that would otherwise keep pointing at deleted files.

**Definition of Done**:

- [x] `README.md` no longer mentions GraphQL support, `/graphql`, `schema.gql`, or `npm run generate-schema`.
- [x] GraphQL references found in `docs/*.md` are either removed or rewritten to reflect the REST-only boilerplate, including `docs/1-code-style.md`, `docs/2-command-and-query-bus.md`, `docs/4-code-generation.md`, `docs/6-architecture.md`, and `docs/7-adding-new-feature.md`.
- [x] `docs/12-splitting-up-graphql-schema-to-separate-files.md` is removed, or if retained, is explicitly rewritten so it no longer documents a removed capability.
- [x] `.github/copilot-instructions.md` no longer describes GraphQL architecture, GraphQL directories, Apollo Server, or `generate-schema` usage as supported project conventions.
- [x] `.eslintignore` and `.prettierignore` no longer reference deleted GraphQL-generated files.
- [x] No remaining project documentation, instructions, or ignore files instruct developers to create, maintain, or exclude GraphQL assets.

#### Task 4.2 - [REUSE] Run targeted validation without adding tests

**Description**: Use existing validation tooling to confirm the repository still compiles and that GraphQL references have been removed from maintained codepaths, without creating new test coverage.

**Definition of Done**:

- [x] No `*.spec.ts` files are added as part of this task.
- [ ] `npm run lint` passes after the cleanup.
- [x] `npm run build` passes after the cleanup.
- [x] A targeted repository search confirms there are no active GraphQL/Apollo/codegen references left in maintained source, Docker packaging, config, scaffolding, documentation, instruction, or ignore files.

## Security Considerations

- Removing `/graphql` reduces the public API surface area, but the implementation must preserve the existing REST middleware order so Helmet, CORS, not-found handling, and the global error handler continue to behave as before.
- Removing GraphQL files without first updating `docker/prod/Dockerfile` would break production image assembly; packaging changes must ship in the same change set.
- Dependency cleanup must be limited to GraphQL-specific packages to avoid accidentally removing libraries used by the REST stack or security middleware.
- Documentation and generators should not leave stale instructions that would encourage developers to reintroduce unsupported GraphQL endpoints without the necessary runtime wiring.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] The application bootstrap and container compile without any GraphQL-related imports, DI registrations, or middleware.
- [x] Production Docker packaging no longer expects `graphql/` to exist in the built repository.
- [x] GraphQL-only files, scripts, templates, and direct package dependencies have been removed, and the lockfile matches the manifest.
- [x] Repository documentation, developer instructions, ignore files, and scaffolding describe a REST/CQRS-only boilerplate, with no instructions to use GraphQL or GraphQL code generation.

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- Add automated dead-code or dead-dependency detection in CI, for example with a tool such as `knip`, to catch future optional integrations that become orphaned.
- Revisit the boilerplate documentation structure so capability-specific docs are easier to add and fully remove without cross-page cleanup.

## Changelog

| Date | Change Description |
| ---- | ------------------ |
| 2026-05-30 | Initial plan created |
| 2026-05-30 | Revised plan to include Docker packaging blocker and explicit repository-level GraphQL cleanup scope |
| 2026-05-30 | Phase 1 implemented: Removed GraphQL from Express app, container, and Docker. |
| 2026-05-30 | Phase 2 implemented: Removed GraphQL source artifacts, including schema, resolvers, generated types, and example adapters. |
| 2026-05-30 | Phase 3 implemented: Removed GraphQL Plop generators, templates, dependencies, and codegen config. package-lock.json update is pending due to Docker constraint. |
| 2026-05-30 | Phase 4 implemented: Cleaned up GraphQL references in docs, README, .github/instructions and ignore files. Tasks 4.2 lint/build left incomplete due to missing npm/build environment. |
| 2026-05-30 | Follow-up cleanup removed remaining GraphQL/body-parser mentions from instruction examples. Validation and lockfile refresh remain blocked by missing npm and inactive Docker daemon. |
| 2026-05-30 | Code review completed: implementation is sound, but package-lock.json refresh and lint/build execution remain pending due environment constraints. |
| 2026-05-30 | Second code review pass: all source and documentation changes confirmed correct. QA item for documentation checked. Pre-existing unused parameter lint patterns in app.ts noted but not introduced by this change. |
| 2026-05-30 | Post-review implementation fix applied: prefixed unused Express callback parameters in src/app/app.ts to align with the project's ESLint argsIgnorePattern convention. |
| 2026-05-30 | Environment follow-up: activated Node via nvm, ran npm install to refresh package-lock.json, and verified npm run build passes. npm run lint remains blocked by unavailable Docker daemon. |

## Code Review Findings

### Review Pass 1 (2026-05-30)

- **Medium**: `package-lock.json` is out of sync with `package.json` and still contains direct GraphQL and `body-parser` entries plus orphaned transitive GraphQL/Apollo/codegen packages. A package-manager refresh is still required before merge.
- **Low**: `npm run lint` and `npm run build` could not be executed in this environment because `npm` is unavailable on `PATH` and Docker daemon access is inactive.
- **Informational**: The code and documentation changes are otherwise consistent with the approved plan. Remaining GraphQL/body-parser search hits are limited to this plan file and the stale lockfile.

### Review Pass 2 (2026-05-30)

**Scope**: Full review against plan Definition of Done, QA checklist, security, and code quality. Covers the current state of all changed files including the updated `src/app/app.ts`.

**Verified Correct**:
- All 17 GraphQL-related files deleted and confirmed absent.
- `src/app/app.ts`: Apollo/GraphQL imports removed, `AppDependencies` simplified to `{ router, errorHandler, appConfig }`, middleware order preserved (cors → helmet → json → health → api-docs → api → 404 → error handler). No regressions introduced.
- `src/container.ts`: `registerGraphQLDependencies` import and call removed, bootstrap order intact.
- `docker/prod/Dockerfile`: `/app/graphql` COPY line removed, remaining copies cover all needed runtime assets.
- `package.json`: All 7 GraphQL/Apollo/codegen packages removed, `generate-schema` script removed. `body-parser` correctly identified as GraphQL-exclusive (the REST stack uses `express.json()`). No non-GraphQL package was removed.
- `plopfile.js`: All GraphQL generators, GraphQL resolver update helpers, and `graphqlResolverLocation` constant removed. All REST/CRUD generators remain intact and reference valid paths.
- All docs, instruction files, ignore files, and `copilot-instructions.md` confirmed clean by comprehensive grep scan.
- Zero GraphQL/Apollo/body-parser references remain in `src/**/*.ts`.

**Issues Found**:
- **Blocker (unchanged from Pass 1)**: `package-lock.json` is stale. Needs `npm install` before merge; CI using `npm ci` will fail otherwise.
- **Environment-blocked (unchanged)**: `npm run lint` and `npm run build` could not be executed — Docker daemon is inactive.
- **Pre-existing ESLint concern (not introduced by this change)**: In `src/app/app.ts` lines 34 and 44, callback parameters `req`/`res`/`next` are unused but not prefixed with `_` as required by the project's `"argsIgnorePattern": "^_"` ESLint rule and established by `src/middleware/error-handler.ts` (which uses `_next`). Git history confirms these patterns existed at HEAD before the GraphQL removal. They are out of scope for this task but should be addressed separately.

**QA Checklist Update**:
- "Repository documentation, developer instructions, ignore files, and scaffolding describe a REST/CQRS-only boilerplate" — **CONFIRMED** ✅ (checked above)
- Remaining three QA items (application compiles, Docker packaging, lockfile sync) remain blocked by environment or the stale lockfile.

### Review Fixes Applied (2026-05-30)

- Resolved: `src/app/app.ts` now prefixes unused Express callback parameters with `_` (`_req`, `_res`) so the file aligns with the project's ESLint `argsIgnorePattern` convention.
- Resolved: `package-lock.json` has been regenerated via `npm install`; GraphQL/Apollo direct entries are removed from the lockfile root and the manifest is now in sync.
- Remaining validation gap: `npm run lint` cannot be executed in the current environment because the Docker daemon is unavailable. `npm run build` now passes.