# Changelog

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