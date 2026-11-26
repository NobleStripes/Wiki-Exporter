# Wiki Exporter

*No AI. Human crawler. For lazy people.*

A lightweight, human-directed utility for exporting wiki articles and categories into clean, research-ready documents.

You find the pages. You choose the sources. The exporter handles the tedious part.

## Features

- **Human-powered discovery:** Find your own articles. The developer assumes you know how to use a search bar.
- **Single article export:** Because copying and pasting entire wiki articles is tedious.
- **Category export:** For when your research obsession gets out of hand.
- **No AI:** It's a document converter. It doesn't need artificial intelligence.
- **No hallucinations:** Any questionable lore comes courtesy of the original wiki contributors.
- **Human quality control:** The developer is also the guinea pig.
- **No subscription:** Nobody should have to pay monthly to convert HTML into Markdown.

**Built out of laziness. Maintained out of spite. Used for research.**

## Development note

AI tools assisted with debugging and rapid prototyping. The extension itself doesn't use AI to generate, summarize, or rewrite content.

Category export is in development: the category page can list articles, but exporting them is not yet implemented.

Article exports are Markdown files with the title, source URL, and retrieval time. The exporter removes scripts, styles, iframes, edit links, ads, and the table of contents.

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
