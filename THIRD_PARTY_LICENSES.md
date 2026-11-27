# Third-party library notices — release review required

Wiki Exporter's own source is distributed under the repository's GNU GPL v3 license. The bundled third-party files retain their own licenses. This inventory is a starting point, **not a substitute for actual copyright and license texts**.

| Bundled library | Upstream | License to verify against the exact distributed version |
|---|---|---|
| Turndown | https://github.com/mixmark-io/turndown | MIT |
| Turndown GFM | https://github.com/mixmark-io/turndown-plugin-gfm | MIT |
| JSZip | https://github.com/Stuk/jszip | MIT or GPL v3; includes dependencies such as pako |
| DOCX core, math and HTML modules | https://github.com/dolanmiu/docx | MIT; inspect bundled dependencies |

For each of the six vendor files in `DEPENDENCY_INVENTORY.json`:

1. Determine the exact version/source distribution originally downloaded. Verify its bytes; use matching official upstream release/source if necessary.
2. Preserve the actual copyright and license notices for the package and its bundled dependencies under `vendor/licenses/`. Do not substitute a generic license name for the complete notices.
3. Set `version`, `exact_source_url`, and `notice_files` in the inventory; set `bundled_dependencies_reviewed` only after inspecting the bundled dependencies. Refresh hashes if verified files change.
4. Review any corresponding-source obligations for the GPL distribution and all redistributed bundled code. Make the applicable source available as required. Do not assume minified files alone satisfy those obligations.
5. Run `prepare_rc.py --project . --store-check`. The script checks presence and consistency, not legal compliance or vulnerability status.

JSZip's bundled file may carry its own notice; keep it intact. Package-specific versions and transitive license details remain unverified until reviewed by the maintainer.
