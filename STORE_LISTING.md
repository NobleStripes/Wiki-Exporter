# Chrome Web Store — RC listing and review notes

## Short description
No AI. Human crawler. For lazy people. Export selected Fandom wiki articles as Markdown, Word, HTML, text or JSON.

## Description
Wiki Exporter is a lightweight, local-first utility for exporting user-selected Fandom wiki articles and research collections into readable, structured documents. Save individual articles, combine selected articles in one document, or package separate files in ZIP archives.

Features include Markdown, DOCX, HTML, TXT and JSON; category and manually selected subcategory retrieval; pasted article links and optional open-tab import; Boolean and fuzzy search; local collection save/open; source metadata, conversion diagnostics and optional previews; independent article, image and video link handling; and local navigation between exported HTML articles.

Batch exports are limited to 100 selected articles, use request spacing and cancellation, and stop on specified access, rate-limit and server errors. All document processing is local. No AI service, advertising, accounts or telemetry are included. Media is represented by descriptions and optional links; media bytes are not downloaded. Custom wiki layouts may convert imperfectly. Use the network retrieval functionality only where authorized and comply with applicable site terms and source licenses.

Wiki Exporter is independent, open source and not affiliated with, endorsed by or sponsored by Fandom, Inc.

## Single purpose
Export user-selected Fandom articles and collections into local research documents.

## Permission explanations
- activeTab: Read the currently opened article after the user activates the extension.
- scripting: Execute the bundled, read-only DOM extraction function.
- optional tabs: Discover matching open Fandom article tabs when the user explicitly invokes the import feature. Attempt to revoke after import.
- optional host access: Request permission for the wiki origins used to load categories, articles and site license metadata.
- Remote code: No remotely hosted executable code should be used. Confirm bundled code and extension CSP against the actual final package.

## Privacy review
The extension handles website content and URLs locally and sends selected article/category queries directly to Fandom. Local-only handling still requires disclosure. Provide the public URL for the reviewed PRIVACY.md in the developer dashboard. Accurately answer dashboard data-handling and remote-code questions; do not mark everything as “no data handled” just because there is no telemetry. Verify the final listing and actual build against current policies.

## Assets
Use your own original extension artwork, not Fandom's branding. Declare PNG icons at 16, 32, 48 and 128 pixels. Prepare store screenshots of your own UI and preferably synthetic or appropriately licensed example content. Include the clean HTML preview, collection search and export settings. Verify current store asset specifications before uploading.

Official references:
- https://developer.chrome.com/docs/extensions/reference/manifest/version
- https://developer.chrome.com/docs/extensions/reference/manifest/icons
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- https://www.fandom.com/terms-of-use
- https://www.fandom.com/licensing
