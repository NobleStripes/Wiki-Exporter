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

## Fandom Content, Attribution and Licensing

Wiki Exporter is an independent, free and open-source
utility designed to assist users with personal research,
offline reading, and document organization.

Wiki Exporter does not claim ownership of any content
retrieved from Fandom-hosted communities.

### Content Licensing

Most community-written articles hosted on Fandom are
licensed under the Creative Commons Attribution-ShareAlike
3.0 Unported License (CC BY-SA 3.0), unless otherwise stated.

Individual communities may use different licenses.
Exported content remains subject to its original license
and applicable copyright conditions.

Wiki Exporter's software license does not extend to
exported wiki content.

### Attribution

All credit belongs to the original wiki contributors
and respective copyright holders.

Wiki Exporter preserves source URLs and, where available,
revision IDs and retrieval timestamps to assist users
with source verification and attribution.

Users redistributing exported content must comply with
the applicable attribution, licensing, and share-alike
requirements.

### Images and Third-Party Material

Images, screenshots, illustrations, game assets, logos,
and other media may be subject to separate copyright
and licensing restrictions.

Such material should not be assumed to fall under the
same license as the accompanying wiki text.

### Responsible Use

Wiki Exporter is designed for user-directed retrieval
and local document conversion.

Category exports space article requests, provide
cancellation controls, and stop on selected server errors.
Each batch export is limited to 100 selected articles.

It is not designed to circumvent access restrictions,
authentication requirements, or rate limits.

Users are responsible for ensuring that their use
complies with applicable website terms, permissions,
content licenses, and laws.

Fandom's terms restrict automated retrieval without
permission and prohibit bypassing access restrictions.
These safeguards reduce server load and prevent
problematic request behavior, but they do not establish
authorization or guarantee protection from account
restrictions. Where permitted, Fandom's official
`Special:Export` is an alternative way to obtain content.

### Project Policies

- **Human-directed retrieval:** Only retrieve articles
  and categories explicitly selected by the user.
- **Read-only operation:** Never edit articles, submit
  forms, or modify wiki accounts.
- **No credential collection:** Do not collect cookies,
  passwords, or authentication tokens.
- **No access-control circumvention:** Stop when the
  website denies access.
- **No background crawling:** No scheduled retrieval or
  automatic discovery of unrelated pages.
- **Local processing:** Generate documents on the
  user's device.
- **Source attribution:** Retain original article URLs
  and, where available, revision information. License
  details are not yet included in exports.
- **No telemetry:** Do not transmit browsing activity or
  exported documents to the developer's servers.

### Independence

Wiki Exporter is not affiliated with, endorsed by,
sponsored by, or operated by Fandom, Inc.

All trademarks and intellectual property belong to
their respective owners.

### References

- Fandom Licensing Policy:
  https://www.fandom.com/licensing

- Fandom Terms of Use:
  https://www.fandom.com/terms-of-use

- Creative Commons BY-SA 3.0:
  https://creativecommons.org/licenses/by-sa/3.0/