# Changelog

## [1.0.0-rc.1] — Release candidate

- Feature freeze; no new export formats or discovery methods.
- Prevent overlapping single-article exports and lock popup preferences during extraction.
- Restrict MediaWiki requests to expected read-only parameter sets; reject malformed JSON responses.
- Validate category pagination tokens, reject repeated cursors, and cap discovery at 50 API pages / 10,000 members. The 100 selected article export cap is unchanged.
- Refresh user documentation; add release checklist, privacy policy draft, and dependency inventory.

## [0.9.3] — Video cleanup
- Independent video link policy, player removal, caption/title preservation and recognizable citation protection.

## [0.9.2] — Gallery cleanup
- Independent image and gallery link policy, captions-only mode, and removal of raw media URL clutter.

## [0.9.1] — Link management
- Retain/strip wiki or inline links, local HTML navigation, revision-link correction and protected attribution/citations.

## [0.9.0] — Export and archival expansion
- HTML, TXT and JSON exports; prepared-content preview; save/open collections; optional local history; combined export manifests.

## [0.8.0] — Research fidelity
- Shared preparation engine, license metadata, revision and contributor history links, infobox preparation, table fallback, conversion diagnostics, custom collection title, article index and Word TOC.

## [0.7.1] — Advanced search
- Boolean operators, exact phrases, exclusions, fuzzy matching, relevance sorting and selected-only review.

## [0.7.0] — Expanded Article Selection

### Added
- Research collection interface.
- Multiple article URL imports.
- Optional open browser tab imports.
- Manual subcategory exploration.
- Cross-community Fandom collections.
- URL normalization and duplicate detection.
- Redirect-based article deduplication.
- Community source labels.
- Clear collection controls.

### Improved
- Search by article title or community domain.
- Collection-level source metadata.
- Batch export statistics.
- Permission requests limited to selected wiki origins.

### Security
- Optional browser tab permissions.
- Tab permission revocation after import.
- Existing request throttling and cooldowns retained.
- Existing 100-article batch limit retained.
- No autonomous recursive crawling.
- No telemetry or AI dependencies.

## [0.6.0] — Selection and Usability Update

### Added
- Category article search and filtering.
- Alphabetical sorting.
- Select Filtered and Deselect Filtered controls.
- Visible article counter.
- Batch size limit indicator.
- Persistent local export preferences.

### Improved
- Article selections persist when filtering.
- Export order follows selected alphabetical sorting.
- Format-dependent output labels.
- Export controls are locked during extraction.

### Fixed
- Markdown-specific labels when exporting DOCX.
- Format settings remaining editable during batch export.

### Unchanged
- 100-article maximum batch size.
- Existing network safeguards.
- Local document processing.
- No AI, telemetry, or background crawling.