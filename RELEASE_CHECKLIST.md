# Wiki Exporter 1.0.0-rc.1 — Release gates

Record browser version, OS, Git commit, result, and issue link for each failure. Mark a test only after executing it. The release candidate is not a stable or store-approved release.

## Local automated checks
- [ ] `prepare_rc.py --project . --check` passes.
- [ ] `test_rc.py --project .` passes with real locally bundled libraries (no live Fandom traffic).
- [ ] No JavaScript errors on popup/category pages; no extra permissions or remote script execution.

## Export regression matrix (use authorized sample sources or local fixtures)
| Format | Single | Combined | Separate ZIP |
|---|---|---|---|
| Markdown | [ ] | [ ] | [ ] |
| DOCX (open in Word; inspect tables, TOC, diagnostics) | [ ] | [ ] | [ ] |
| HTML (open with network disconnected) | [ ] | [ ] | [ ] |
| TXT | [ ] | [ ] | [ ] |
| JSON (validate JSON) | [ ] | [ ] | [ ] |

- [ ] Combined export with optional JSON manifest ZIP.
- [ ] Compare source title, revision, visible text, infobox, headings, tables, citations, license evidence, and warnings.
- [ ] Test retain/strip wiki/strip inline/local navigation options; local links work only in HTML and unknown targets retain original URL.
- [ ] Image/gallery and video preferences are independent; captions survive, no media bytes or executable players.
- [ ] Open extracted separate HTML archive; navigation between files and section anchors works offline.
- [ ] Review, confirm and discard prepared-content preview.
- [ ] Save/open collection; manually unchecked items remain unchecked; malformed/oversized imports leave existing collection intact.
- [ ] Boolean AND/OR/NOT, quoted phrases, exclusions, invalid expressions, fuzzy spelling, relevance, selected-only review, invert, clear search and manual deselection.
- [ ] Verify permissions denied, allowed, and revoked; current-window tab import starts unchecked.
- [ ] Single popup rapid repeated clicks do not create concurrent exports; format controls lock and restore after success/error.
- [ ] Simulated repeated pagination cursor / malformed response / oversized category is stopped and reported.
- [ ] Selection over 100 disables export; reduce selection to recover.
- [ ] Simulate 401, 403, 429, 503, timeout, malformed JSON and API maxlag; stop/cooldown preserved. Never deliberately overload a website.
- [ ] Simulate cancellation during retrieval; partial export includes previously completed articles and accurate counts.
- [ ] History defaults off; opt-in, clear and disable behaviour; no article URLs stored in history.

## Browser matrix
| Browser | Installation | Single export | Batch + ZIP | Preview | Network controls |
|---|---|---|---|---|---|
| Chrome (reference) | [ ] | [ ] | [ ] | [ ] | [ ] |
| Edge | [ ] | [ ] | [ ] | [ ] | [ ] |
| Brave | [ ] | [ ] | [ ] | [ ] | [ ] |
| Vivaldi | [ ] | [ ] | [ ] | [ ] | [ ] |
| Opera | [ ] | [ ] | [ ] | [ ] | [ ] |

Firefox and Safari are separate ports; do not claim support until tested. They need not block a clearly Chrome-only initial release.

## Public distribution gates
- [ ] Confirm source-site authorization for the intended programmatic retrieval; safeguards and open content licensing are not permission to access the service automatically.
- [ ] Verify exact library versions, integrity, known vulnerabilities, full license notices, bundled dependencies and corresponding-source obligations.
- [ ] Review the privacy policy against final code and publish it at an accessible URL.
- [ ] Audit arbitrary wiki HTML handling in all output paths, particularly Markdown and DOCX; no remote active content or data exfiltration.
- [ ] Supply original icons, listing and screenshots; check current store requirements.
- [ ] `prepare_rc.py --project . --store-check` passes (mechanical checks only).
- [ ] Review allowlisted ZIP; no exported content, secrets, .git, development files or unverified dependencies.
- [ ] Resolve blocking bugs; rerun checks on final commit. Prepare stable 1.0.0 only after sign-off.
