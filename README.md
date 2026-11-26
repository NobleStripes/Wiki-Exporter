# Wiki Exporter

A lightweight Chrome extension that exports Fandom articles as Markdown. No AI—just a human crawler for lazy people.

## Features

- Extracts article content from Fandom pages.
- Converts the article to Markdown, including GitHub Flavored Markdown formatting.
- Adds the article title, source URL, and retrieval time to the export.
- Removes scripts, styles, iframes, edit links, ads, and the table of contents from the extracted content.
- Downloads the result as a `.md` file.

## Requirements

- Google Chrome
- The extension files in this repository, including the Turndown scripts in `vendor/`

## Install

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose this project's folder.

## Use

1. Open an article on a Fandom wiki.
2. Select the **Wiki Exporter** extension from Chrome's toolbar.
3. Select **Export article as Markdown**.
4. Save the downloaded Markdown file.

The extension currently supports Fandom pages only.

## Project files

- `manifest.json` — Chrome extension metadata and permissions.
- `popup.html` and `popup.js` — The extension popup and export behavior.
- `vendor/` — Turndown and its GitHub Flavored Markdown plugin.
