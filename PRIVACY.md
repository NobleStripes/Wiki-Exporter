# Wiki Exporter — Privacy policy (review before publication)

Wiki Exporter is an independent, locally operated browser extension for converting user-selected Fandom wiki articles into documents. No account, analytics service, advertising, AI service, or developer-operated server is required.

## Information handled

- When invoked on an open wiki page, the extension accesses that page's URL, title, article content and available source metadata to generate the requested export.
- When you load categories or export a collection, the extension sends read-only requests directly to the relevant Fandom wiki's MediaWiki API, including article titles and category names. It does not intentionally transmit authentication cookies with these API requests. Fandom receives ordinary connection/request information (including IP address and request details) and has its own terms and privacy policy.
- If you activate open-tab import, the extension requests optional tab access, queries matching open Fandom wiki tabs in the current window, and attempts to revoke the permission after import. Imported links appear in your collection for selection. It does not monitor browsing activity in the background.
- Article content is processed on your device. Collection files are created only at your request; they contain selected and unselected article links, source categories, and preferences rather than downloaded article bodies. Export files may contain the information present in the selected wiki pages, including any personal information that their authors published.

## Local storage and controls

The extension stores export and search preferences, request timing, and server cooldown state in extension-local browser storage. Collections in the active page are held in memory unless saved explicitly. Optional export history is off by default; if enabled, it stores up to 50 download request records with time, format, packaging mode, article count and partial-export status, not article URLs or content. Clear History removes those records; disabling history clears them as well. You can remove saved files yourself, close the collection page, revoke site permissions in your browser's extension settings, or remove the extension to remove its local state. Files you already downloaded remain on your device.

## Sharing and remote services

The developer does not receive exported content, collections, or browsing activity, and does not sell that information. Document conversion is local, using bundled libraries. Generated HTML does not automatically fetch media or execute remote scripts. Following preserved hyperlinks opens their destinations through your browser; those sites have their own privacy practices. The browser and extension store may separately process installation or update information under their own policies.

## Permissions

- `activeTab`: access the active article after the user invokes the extension.
- `scripting`: read the rendered article via a bundled extraction function.
- Optional `tabs`: import matching open wiki tabs when requested.
- Optional Fandom host access: retrieve selected categories, articles and site license information from the permitted wiki origins.

## Questions

Open an issue at https://github.com/NobleStripes/Wiki-Exporter/issues (do not include private browsing information or sensitive exported content in a public issue).

Wiki Exporter is not affiliated with Fandom, Inc. Review the original site's content licensing and access rules before reuse.

**Maintainer review:** Confirm these statements against the final packaged build and publish a stable, accessible privacy policy URL before store submission. Remove this review note from the published policy.
