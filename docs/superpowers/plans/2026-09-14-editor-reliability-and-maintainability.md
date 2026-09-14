# Reliable Editor and Maintainable Core — Implementation Plan

## Goal

Make Sparktype dependable for creating, editing, saving, restoring, previewing, and publishing sites. Implement the work incrementally, with regression tests for each defect and separate commits for structural refactors.

Desktop authentication is disabled for this release. Browser authentication retains its current behaviour. Preserve existing site data, public service interfaces where practical, and the user's existing modification to `src-tauri/capabilities/default.json`.

## Implementation rules

- Reproduce each bug with a failing test before fixing it.
- Separate behaviour-preserving extractions from functional changes.
- Split files by responsibility. Aim for modules around 150–350 lines; treat 400 lines as a review trigger, not an arbitrary limit.
- Keep orchestration functions short and dependencies explicit. Avoid generic utility files and new frameworks.
- Comment non-obvious invariants, compatibility decisions, failure handling, and security boundaries. Remove outdated comments and comments that merely narrate the code.
- Follow `AGENTS.md`, including Context7 documentation checks when changing library or API usage.
- Do not deploy to live accounts as part of validation.
- File paths below are relative to the repository root. Proposed module names are implementation targets; reuse existing equivalent modules instead of duplicating their responsibilities.

## 1. Establish a reproducible baseline

- [ ] Work in a dedicated branch. Record the current diff before making changes.
- [ ] Use Node 22, matching CI, and document the supported runtime through a version file and package metadata.
- [ ] Run `npm run build:web`, `npm test`, `npm run lint`, and `npm run test:e2e`.
- [ ] Fix test-environment setup explicitly rather than masking errors. Replace machine-speed assertions with deterministic checks where possible.

The review baseline was: successful web build, three passing browser tests, four lint errors, seven warnings, seven unit-test setup failures under Node 26, and two timing failures that passed on rerun.

**Acceptance:** baseline failures are explained, reproducible, and tracked; unrelated user changes remain untouched.

## 2. Disable desktop authentication consistently

Primary files:

- `src/core/state/slices/siteSlice.ts`
- `src/core/state/slices/authSlice.ts`
- `src/core/services/remoteImport.service.ts`
- `src/core/services/webauthn.service.ts`
- `src/core/components/AuthGuard.tsx`
- `src/core/components/CreateSiteModal.tsx`
- `src/pages/sites/settings/SecurityPage.tsx`
- `src-tauri/src/lib.rs`
- `src-tauri/src/webauthn.rs`

- [ ] Introduce one explicit authentication policy shared by site loading, imports, authentication status, and settings.
- [ ] On desktop, open existing protected sites without prompting and allow importing protected sites without invoking native authentication.
- [ ] Preserve `manifest.auth` unchanged, including during save and export.
- [ ] Replace desktop authentication controls with “Edit protection is currently unavailable in the desktop app.” This covers site creation as well as site settings: `CreateSiteModal.tsx` renders the same “Edit protection” switch and is a separate control path from `SecurityPage.tsx`.
- [ ] Do not create fake authenticated sessions.
- [ ] Remove or disable native authentication command registration and development success simulation.
- [ ] Keep site-loading guards operational: disabling authentication must not bypass loading and error handling.
- [ ] Test protected/unprotected desktop sites, protected desktop imports, desktop site creation with protection never offered, absence of native command calls, auth metadata round trips, and unchanged browser protection behaviour. Site creation needs explicit browser-test coverage: the existing smoke suite asserts on the `#edit-protection` switch during creation, so that assertion changes with this work.

**Acceptance:** desktop editing works for existing protected sites, without authentication prompts or claims that protection is active.

## 3. Split the content slice and fix collection slug changes

Refactor `src/core/state/slices/contentSlice.ts` into a thin composition module plus focused modules under `src/core/state/slices/content/`:

| Proposed module | Responsibility |
|---|---|
| `contentActions.ts` | Create, update, and delete content |
| `navigationActions.ts` | Navigation ordering and placement |
| `slugActions.ts` | Coordinate slug changes and persistence |
| `slugPaths.ts` | Pure path calculations and validation |
| `collectionRefs.ts` | Build and update collection references |
| `tagActions.ts` | Tag and tag-group operations, including their lookup helpers |

Tag and tag-group operations currently occupy roughly 190 lines of the slice and belong in `tagActions.ts` rather than being left behind. `collectionRefs.ts` is a shared derivation rather than a leaf responsibility: the collection-item index is rebuilt from `contentFiles` after most content mutations, so keep that helper explicit about its callers instead of treating it as an independent module.

- [ ] Preserve the existing store API. Characterise page creation, deletion, nested moves, and persistence before extracting code.
- [ ] Fix slug changes by distinguishing navigation pages from collection items.
- [ ] Update the correct manifest references, stored file path, in-memory content, and editor route.
- [ ] Always clear slug-change tracking in `finally`, including validation failures.
- [ ] Decide the fate of the legacy `changePageSlug` implementation: it duplicates the rename logic, has no remaining callers, and never participates in slug-change tracking. Consolidate it into the live path or delete it rather than carrying two copies into the split.
- [ ] Test collection-item rename; ordinary and nested page rename; collision rejection; homepage restriction; persistence failure; and reload after rename.

**Acceptance:** failed operations do not lose the original content or leave the editor permanently busy. Successful collection-item renames survive reload and retain collection membership.

## 4. Repair backup export and restoration

Split `src/core/services/siteBackup.service.ts` into a facade and focused export, import, and archive-validation modules under `src/core/services/backup/`.

- [ ] Define and document the backup contract: preserve Markdown, manifest, secrets, original media, media metadata, site data files, and custom themes/layouts.
- [ ] Export the media index that restoration requires.
- [ ] Read content only from `_site/content/` and only supported Markdown entries.
- [ ] Never interpret secrets, manifests, templates, or binary assets as content. In particular, do not iterate JSZip's archive-wide `.files` map as though it were scoped to a folder.
- [ ] Restore legacy backups containing originals but no media index through an explicit compatibility path.
- [ ] Reject malformed required data before replacing an existing site.
- [ ] Audit how malformed imports from the previous implementation could reach public exports. Add export-boundary protection against non-content entries.
- [ ] Export a representative site, clear storage, import, persist, reload, and compare content, metadata, and original image bytes.
- [ ] Assert the exact content-file set; do not filter unexpected entries out of assertions.
- [ ] Cover legacy archives, malformed manifests, missing assets, and custom layouts.

**Acceptance:** a backup restores a complete site into fresh storage, and unrelated archive entries never become content files.

## 5. Make publication filtering consistent and repair XML output

Primary files: `src/core/services/siteBuilder.service.ts`, the modules under `src/core/services/builder/`, and collection/navigation queries used during export.

- [ ] Create a publication-selection module used by the complete build pipeline. Derive a public snapshot without mutating the editor's working state or persistent site storage: building, previewing, or exporting must not write to or delete from the site's stored data.
- [ ] Filter unpublished pages and collection items consistently across HTML pages, pagination, collection listings, navigation, Markdown source files, public manifest references, RSS, and sitemap output.
- [ ] Continue supporting drafts in preview, and define that behaviour per listing path rather than as a single rule. Preview listing helpers currently disagree: the `{{#query}}` helper filters unpublished files while `render_collection` does not, so the same preview page can include and exclude the same draft.
- [ ] Return a clear build error for an unpublished homepage rather than silently publishing it.
- [ ] Fix XML escaping in `src/core/services/builder/metadata.builder.ts`, including CDATA terminators in content.
- [ ] Inspect complete bundles for draft body text, titles, URLs, and source paths.
- [ ] Verify published content remains intact and the original site is unchanged. Remove the image-cleanup call that `bundleAllAssets` runs during bundle construction: a derived snapshot does not make it safe, because cleanup still writes to persistent storage under the site's own ID. Test that exporting preserves stored originals, including images referenced only by unpublished content.
- [ ] Fix collection content caching. The cache key omits the site identity and the validity hash omits frontmatter, so two sites with matching collection configuration and file counts can serve each other's content, and toggling `published` can return a stale listing. Remove the cache initially, or make it sensitive to both site identity and content changes.
- [ ] Parse RSS and sitemap as XML with ampersands, angle brackets, Unicode, and `]]>` fixtures.

**Acceptance:** content marked `published: false` does not appear in generated public content or references, generated XML is well formed, and building or exporting a site leaves its stored assets untouched.

## 6. Split the renderer without changing rendering behaviour

Refactor `src/core/services/renderer/render.service.ts` using the existing renderer services and helpers.

- [ ] Extract Markdown/MDX conversion and sanitisation into a focused module.
- [ ] Extract layout hierarchy rendering into a focused module.
- [ ] Extract image URL processing for preview and export into a focused module.
- [ ] Extract collection directive processing and shared render types.
- [ ] Leave `render.service.ts` coordinating these stages. Avoid duplicating existing helpers or introducing circular imports.
- [ ] Add comments explaining sanitisation boundaries, preview/export differences, and why processing order matters.
- [ ] Preserve existing rendering fixtures and add coverage for nested layouts, collection pagination, images, embeds, and relative export paths.

**Acceptance:** output remains equivalent for existing supported fixtures. Keep this refactor separate from publication-policy changes.

## 7. Repair and split GitHub publishing

Refactor `src/core/services/publishing/git.service.ts` into a provider orchestrator, API client, binary/blob uploader, and deployment-tree planner.

- [ ] Upload every binary asset through the blob API with explicit base64 encoding, regardless of size. Inline tree content is literal text, not base64-decoded binary.
- [ ] Resolve the current commit's tree SHA correctly.
- [ ] Track generated paths so subsequent deployments explicitly delete obsolete generated files.
- [ ] Preserve unrelated repository files.
- [ ] Handle repositories created before path tracking conservatively; never infer that every repository file belongs to Sparktype.
- [ ] Keep branch updates non-forcing and surface concurrent-update failures.
- [ ] Preserve GitHub's original error response instead of treating every failed ref update as a missing branch. The current fallback catches the update failure and reports it as a branch-creation attempt, so a non-fast-forward rejection is misreported and its error body is discarded before the caller sees it.
- [ ] Validate actual request payloads through mocked HTTP, rather than mocking the entire provider.
- [ ] Cover small/large binary assets, UTF-8 text, empty repositories, missing branches, renamed/deleted/unpublished pages, unrelated files, and a branch changing during deployment.

API contract reference: https://docs.github.com/en/rest/git/trees#create-a-tree

**Acceptance:** published binary bytes are correct, obsolete generated paths are deleted, unrelated files survive, and concurrent remote changes are not overwritten.

## 8. Make image cleanup delete stored assets

Primary files: `src/core/services/images/imageCleanup.service.ts`, `src/core/services/localFileSystem.service.ts`, and image registry/storage helpers.

- [ ] Keep bulk image saving explicitly additive.
- [ ] Change cleanup to delete orphaned blobs through explicit deletion operations. Removing cleanup from the bundle/export path (section 5) must land before any of this work ships: export currently invokes cleanup, so enabling real deletion while that call remains would delete stored assets as a side effect of exporting a site.
- [ ] Remove registry records only after successful blob deletion.
- [ ] Report freed bytes only for successful deletions.
- [ ] Check that legacy migration cannot recreate deleted assets on subsequent reads.
- [ ] Clean up a mixed set of referenced and orphaned images, reopen storage, and confirm actual absence.
- [ ] Verify exports exclude deleted originals, retained images remain byte-identical, and partial failures produce accurate results.

**Acceptance:** cleanup's storage savings reflect actual deleted blobs and remain true after reopening the site.

## 9. Complete maintainability and quality cleanup

- [ ] Fix lint errors and hook dependencies without blanket rule suppression.
- [ ] Replace whole-store subscriptions in touched components with focused selectors.
- [ ] Inspect editor bundle composition. Defer optional media functionality where practical, while preserving editor interactions; avoid speculative dependency upgrades.
- [ ] Update `README.md`, `AGENTS.md`, and relevant documentation to describe TipTap, desktop authentication status, backup compatibility, and module boundaries.
- [ ] Add lint to `.github/workflows/ci.yml`.

**Acceptance:** no new circular dependencies, stale comments, unexplained broad subscriptions, or oversized orchestration modules.

## 10. Validate the complete editor workflow

- [ ] Run all required checks on the supported runtime:

```bash
npm run lint
npm run build:web
npm test
npm run test:e2e
npm run build
```

- [ ] Validate a desktop build in an appropriately provisioned environment.
- [ ] Expand browser coverage to exercise: create site → edit → save → reload → rename collection item → upload image → backup → restore → preview → export.
- [ ] Confirm the user's pre-existing changes remain intact.
- [ ] Finish with a concise change summary, verification results, remaining limitations, and final working-tree status.

## Completion criteria

All supported-runtime checks pass; desktop editing requires no authentication; backups restore complete sites; drafts remain unpublished; GitHub asset bytes and deletions are correct; cleanup genuinely removes data; and the large modules have clear, documented responsibilities.
