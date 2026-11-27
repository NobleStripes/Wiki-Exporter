
// ========================================
// Wiki Exporter — Batch Extraction Engine
// ========================================

(() => {

    const exportButton = document.getElementById("export-batch");
    const cancelButton = document.getElementById("cancel-batch");
    const loadButton = document.getElementById("load-category");
    const articleList = document.getElementById("article-list");
    const status = document.getElementById("batch-status");
    const progress = document.getElementById("batch-progress");
    const report = document.getElementById("batch-report");
    const outputOptions =
        document.getElementById("output-options");
    const formatOptions =
        document.getElementById("format-options");

    const selectAllButton =
        document.getElementById("select-all");

    const selectNoneButton =
        document.getElementById("select-none");

    const selectionCount =
        document.getElementById("selection-count");

    const searchInput =
        document.getElementById("article-search");

    const sortSelect =
        document.getElementById("article-sort");

    const selectFilteredButton =
        document.getElementById("select-filtered");

    const deselectFilteredButton =
        document.getElementById("deselect-filtered");

    const batchLimit =
        document.getElementById("batch-limit");

    const filterEmpty =
        document.getElementById("filter-empty");

    const combinedLabel =
        document.getElementById("combined-label");

    const separateLabel =
        document.getElementById("separate-label");

    const collator = new Intl.Collator(undefined, {
        sensitivity: "base",
        numeric: true
    });

    let controller = null;

    // ========================================
    // Article Search, Sorting and Selection
    // ========================================

    function getArticleRows() {

        const rows = [...articleList.querySelectorAll("label")];

        const direction =
            sortSelect.value === "desc" ? -1 : 1;

        return rows.sort((a, b) => {

            return direction * collator.compare(
                a.textContent.trim(),
                b.textContent.trim()
            );

        });
    }

    // ========================================
    // Retrieve selected articles
    // ========================================

    function getSelectedArticles() {

        const selected = getArticleRows()
            .map(row =>
                row.querySelector('input[type="checkbox"]')
            )
            .filter(box => box?.checked)
            .map(box => box.value);

        return [...new Set(selected)];
    }

    // ========================================
    // Filter and sort visible articles
    // ========================================

    function applyArticleView() {

        const query = searchInput.value
            .trim()
            .toLocaleLowerCase();

        const rows = getArticleRows();

        rows.forEach((row, index) => {

            const title = row.textContent
                .trim()
                .toLocaleLowerCase();

            row.hidden = !title.includes(query);

            row.style.order = index;

        });

        return rows;
    }

    // ========================================
    // Synchronize interface controls
    // ========================================

    function syncControls() {

        const rows = applyArticleView();

        const visibleRows = rows.filter(
            row => !row.hidden
        );

        const total = rows.length;

        const selected =
            getSelectedArticles().length;

        const visibleSelected = visibleRows.filter(
            row => row.querySelector("input")?.checked
        ).length;

        const exporting = controller !== null;

        const overLimit =
            selected > WikiRequest.MAX_BATCH;

        // Selection statistics.

        selectionCount.textContent =
            `${visibleRows.length} visible · ` +
            `${selected} of ${total} selected`;

        batchLimit.textContent =
            `${selected} / ${WikiRequest.MAX_BATCH} batch limit`;

        batchLimit.classList.toggle(
            "over-limit",
            overLimit
        );

        if (overLimit) {

            batchLimit.textContent +=
                " — reduce selection";

        }

        filterEmpty.hidden =
            total === 0 || visibleRows.length > 0;

        // Export controls.

        exportButton.disabled =
            exporting || selected === 0 || overLimit;

        cancelButton.disabled =
            !exporting || controller.signal.aborted;

        // Global selection controls.

        selectAllButton.disabled =
            exporting || total === 0 ||
            selected === total;

        selectNoneButton.disabled =
            exporting || selected === 0;

        // Filtered selection controls.

        selectFilteredButton.disabled =
            exporting ||
            visibleRows.length === 0 ||
            visibleSelected === visibleRows.length;

        deselectFilteredButton.disabled =
            exporting || visibleSelected === 0;

        // Search and sorting controls.

        searchInput.disabled =
            exporting || total === 0;

        sortSelect.disabled =
            exporting || total === 0;

        // Lock output preferences during export.

        formatOptions.disabled = exporting;
        outputOptions.disabled = exporting;
    }

    // ========================================
    // Bulk selection
    // ========================================

    function setArticlesChecked(
        checked,
        filteredOnly = false
    ) {

        if (controller) return;

        const rows = getArticleRows();

        for (const row of rows) {

            if (filteredOnly && row.hidden) {
                continue;
            }

            const checkbox = row.querySelector(
                'input[type="checkbox"]'
            );

            if (checkbox) {
                checkbox.checked = checked;
            }

        }

        syncControls();
    }

    // ========================================
    // Selection event listeners
    // ========================================

    selectAllButton.addEventListener("click", () => {

        setArticlesChecked(true);

    });

    selectNoneButton.addEventListener("click", () => {

        setArticlesChecked(false);

    });

    selectFilteredButton.addEventListener("click", () => {

        setArticlesChecked(true, true);

    });

    deselectFilteredButton.addEventListener("click", () => {

        setArticlesChecked(false, true);

    });

    searchInput.addEventListener("input", syncControls);

    sortSelect.addEventListener("change", () => {

        WikiSettings.set("sort", sortSelect.value);

        syncControls();

    });

    articleList.addEventListener("change", syncControls);

    // ========================================
    // Export Preferences
    // ========================================

    function syncOutputLabels() {

        const format = formatOptions.querySelector(
            'input[name="export-format"]:checked'
        )?.value || "md";

        combinedLabel.textContent =
            `Combined document (.${format})`;

        separateLabel.textContent =
            `Separate .${format} files (.zip)`;
    }

    // Restore saved preferences.

    function restorePreferences() {

        const format = WikiSettings.get("format");
        const output = WikiSettings.get("output");

        const formatRadio = formatOptions.querySelector(
            `input[value="${format}"]`
        );

        const outputRadio = outputOptions.querySelector(
            `input[value="${output}"]`
        );

        if (formatRadio) {
            formatRadio.checked = true;
        }

        if (outputRadio) {
            outputRadio.checked = true;
        }

        sortSelect.value = WikiSettings.get("sort");

        syncOutputLabels();
    }

    // Remember format changes.

    formatOptions.addEventListener("change", () => {

        const format = formatOptions.querySelector(
            'input[name="export-format"]:checked'
        )?.value;

        WikiSettings.set("format", format);

        syncOutputLabels();

    });

    // Remember packaging changes.

    outputOptions.addEventListener("change", () => {

        const output = outputOptions.querySelector(
            'input[name="output-mode"]:checked'
        )?.value;

        WikiSettings.set("output", output);

    });

    restorePreferences();

    new MutationObserver(() => {
        if (!controller) {
            progress.value = 0;
            progress.hidden = true;
            status.textContent = "";
            report.textContent = "";
            report.hidden = true;
        }

        syncControls();

    }).observe(articleList, {
        childList: true
    });

    // ========================================
    // Retrieve article through MediaWiki
    // ========================================

    async function fetchArticle(articleUrl, origin, signal) {

        const url = new URL(articleUrl);

        if (
            url.protocol !== "https:" ||
            url.origin !== origin ||
            !url.pathname.startsWith("/wiki/")
        ) {
            throw new Error("Invalid article URL.");
        }

        const page = decodeURIComponent(
            url.pathname.replace(/^\/wiki\//, "")
        );

        const params = new URLSearchParams({
            action: "parse",
            page: page,
            prop: "text|revid",
            redirects: "1",
            format: "json",
            formatversion: "2"
        });

        const data = await WikiRequest.getJSON(
            url.origin,
            params,
            signal
        );

        const parsed = data.parse;

        const html = typeof parsed?.text === "string"
            ? parsed.text
            : parsed?.text?.["*"];

        if (!html || !html.trim()) {
            throw new Error("No article content received.");
        }

        const sourceUrl = `${url.origin}/wiki/${encodeURIComponent(
            parsed.title.replaceAll(" ", "_")
        )
            }`;

        return {
            title: parsed.title,
            url: sourceUrl,
            revision: parsed.revid,
            html: html
        };
    }

    // ========================================
    // Clean article HTML
    // ========================================

    function cleanArticle(html, baseUrl) {

        const template = document.createElement("template");
        template.innerHTML = html;

        const content =
            template.content.querySelector(".mw-parser-output")
            || template.content;

        content.querySelectorAll(`
            script,
            style,
            iframe,
            .mw-editsection,
            .wikia-ad,
            .toc
        `).forEach(element => element.remove());

        // Convert relative hyperlinks to absolute URLs.

        content.querySelectorAll("a[href]")
            .forEach(link => {

                try {
                    const url = new URL(
                        link.getAttribute("href"),
                        baseUrl
                    );

                    if (["http:", "https:"].includes(url.protocol)) {
                        link.setAttribute("href", url.href);
                    } else {
                        link.removeAttribute("href");
                    }

                } catch {
                    link.removeAttribute("href");
                }
            });

        // Preserve usable image URLs.

        content.querySelectorAll("img")
            .forEach(image => {

                const source =
                    image.getAttribute("data-src") ||
                    image.getAttribute("src");

                try {

                    const url = new URL(source || "", baseUrl);

                    if (
                        source &&
                        ["http:", "https:"].includes(url.protocol)
                    ) {
                        image.setAttribute("src", url.href);
                    } else {
                        image.removeAttribute("src");
                    }

                } catch {
                    image.removeAttribute("src");
                }

            });

        return content;
    }

    // ========================================
    // Markdown conversion
    // ========================================

    function convertArticle(article, converter) {

        const content = cleanArticle(
            article.html,
            article.url
        );

        const markdown = converter.turndown(content);

        if (!markdown.trim()) {
            throw new Error("Converted article is empty.");
        }

        return [
            `# ${article.title}`,
            `Source: ${article.url}`,
            `Revision ID: ${article.revision ?? "Unavailable"}`,
            `Retrieved: ${new Date().toISOString()}`,
            "",
            markdown

        ].join("\n\n");
    }

    // ========================================
    // Download combined Markdown
    // ========================================

    function downloadFile(content, filename) {

        const blob = content instanceof Blob
            ? content
            : new Blob([content], {
                type: "text/markdown;charset=utf-8"
            });

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 30000);
    }

    // ========================================
    // Batch extraction
    // ========================================

    async function exportBatch() {

        if (controller) return;

        const articles = getSelectedArticles();
        const outputMode = outputOptions.querySelector(
            'input[name="output-mode"]:checked'
        )?.value || "combined";

        const exportFormat = formatOptions.querySelector(
            'input[name="export-format"]:checked'
        )?.value || "md";

        if (!articles.length) {
            status.textContent = "No articles selected.";
            return;
        }

        if (articles.length > WikiRequest.MAX_BATCH) {

            status.textContent =
                `You selected ${articles.length} articles. ` +
                `The maximum is ${WikiRequest.MAX_BATCH} ` +
                "articles per export. Reduce your selection.";

            return;
        }

        const categoryUrl = new URL(
            new URLSearchParams(location.search).get("url")
        );

        const categoryName = decodeURIComponent(
            categoryUrl.pathname
                .replace(/^\/wiki\/Category:/, "")
        ).replaceAll("_", " ");

        controller = new AbortController();

        const signal = controller.signal;
        const completed = [];
        const failed = [];

        let stopReason = "";

        loadButton.disabled = true;
        outputOptions.disabled = true;

        articleList.querySelectorAll('input[type="checkbox"]')
            .forEach(box => box.disabled = true);

        syncControls();

        progress.hidden = false;
        progress.max = articles.length;
        progress.value = 0;

        report.hidden = true;
        report.textContent = "";

        try {

            if (exportFormat === "docx") {
                WikiDocx.ensureReady();
            }

            const converter = new TurndownService({
                headingStyle: "atx",
                bulletListMarker: "-",
                codeBlockStyle: "fenced"
            });

            converter.use(turndownPluginGfm.gfm);

            for (let i = 0; i < articles.length; i++) {

                if (signal.aborted) break;

                status.textContent =
                    `Extracting article ${i + 1} of ${articles.length}...`;

                try {

                    const article = await fetchArticle(
                        articles[i],
                        categoryUrl.origin,
                        signal
                    );

                    completed.push({
                        ...article,

                        retrievedAt: new Date().toISOString(),

                        markdown: exportFormat === "md"
                            ? convertArticle(article, converter)
                            : null
                    });

                } catch (error) {

                    if (signal.aborted) break;

                    failed.push({
                        url: articles[i],
                        reason: error.message
                    });

                    if (error.stopBatch) {
                        stopReason = error.message;
                        progress.value = i + 1;
                        break;
                    }
                }

                progress.value = i + 1;
            }

            const unprocessed =
                articles.length - completed.length - failed.length;

            const partial =
                signal.aborted ||
                failed.length > 0 ||
                unprocessed > 0;

            const summary = [
                `# Category Export: ${categoryName}`,
                `Source: ${categoryUrl.href}`,
                `Selected articles: ${articles.length}`,
                `Successfully extracted: ${completed.length}`,
                `Failed: ${failed.length}`,
                `Unprocessed: ${unprocessed}`,
                `Export status: ${partial ? "Partial" : "Complete"}`
            ];

            const failures = failed.map(
                entry => `- ${entry.url}: ${entry.reason}`
            );

            if (failures.length) {
                report.hidden = false;
                report.textContent =
                    "Failed articles:\n" + failures.join("\n");
            }


            if (completed.length) {

                const safeName = categoryName
                    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
                    .trim()
                    .slice(0, 120) || "Category";

                const baseFilename =
                    `Wiki_${safeName}${partial ? "_partial" : ""}`;

                cancelButton.disabled = true;

                // ====================================
                // Combined Markdown document
                // ====================================


                if (outputMode === "combined") {

                    if (exportFormat === "docx") {

                        status.textContent =
                            "Generating Word document...";

                        const docxBlob =
                            await WikiDocx.createDocument(
                                completed,
                                summary,
                                failures
                            );

                        downloadFile(
                            docxBlob,
                            `${baseFilename}.docx`
                        );

                    } else {

                        const documentContent = [

                            summary.join("\n\n"),

                            ...completed.map(
                                article => article.markdown
                            ),

                            ...(failures.length
                                ? [
                                    "# Failed Articles\n\n" +
                                    failures.join("\n")
                                ]
                                : [])

                        ].join("\n\n---\n\n");

                        downloadFile(
                            documentContent,
                            `${baseFilename}.md`
                        );
                    }
                }


                // ====================================
                // Separate Markdown files in ZIP
                // ====================================

                else if (outputMode === "separate") {

                    status.textContent =
                        "Creating ZIP archive...";

                    const zip = new JSZip();

                    const folder = zip.folder("articles");

                    const manifest = [
                        summary.join("\n\n"),
                        "",
                        "## Exported Articles",
                        ""
                    ];


                    for (const [index, article] of completed.entries()) {

                        const safeTitle = article.title
                            .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
                            .replace(/\s+/g, "_")
                            .trim()
                            .slice(0, 120) || "Article";

                        const number = String(index + 1)
                            .padStart(3, "0");

                        const filename =
                            `${number}_${safeTitle}.${exportFormat}`;

                        status.textContent =
                            `Generating file ${index + 1} of ${completed.length}...`;

                        const fileContent = exportFormat === "docx"

                            ? await WikiDocx.createDocument([article])

                            : article.markdown;

                        folder.file(filename, fileContent);

                        manifest.push(
                            `- ${filename}: ${article.url}`
                        );
                    }

                    if (failures.length) {

                        manifest.push(
                            "",
                            "## Failed Articles",
                            "",
                            ...failures
                        );

                    }

                    zip.file(
                        exportFormat === "docx"
                            ? "export_report.txt"
                            : "export_report.md",

                        manifest.join("\n")
                    );
                    
                    const zipBlob = await zip.generateAsync({

                        type: "blob",
                        compression: "DEFLATE",

                        compressionOptions: {
                            level: 6
                        }

                    }, metadata => {

                        status.textContent =
                            `Creating ZIP: ${metadata.percent.toFixed(0)
                            }%`;

                    });

                    downloadFile(
                        zipBlob,
                        `${baseFilename}.zip`
                    );

                }
            }


            const message = signal.aborted
                ? "Export cancelled."
                : stopReason
                    ? `Export stopped: ${stopReason}.`
                    : "Export finished.";

            status.textContent =
                `${message} ${completed.length} exported, ` +
                `${failed.length} failed, ${unprocessed} unprocessed.`;

        } catch (error) {

            status.textContent = error.message;

        } finally {

            controller = null;
            loadButton.disabled = false;
            outputOptions.disabled = false;

            articleList.querySelectorAll('input[type="checkbox"]')
                .forEach(box => box.disabled = false);

            syncControls();
        }
    }

    // ========================================
    // Event listeners
    // ========================================

    exportButton.addEventListener("click", exportBatch);

    cancelButton.addEventListener("click", () => {

        if (controller) {
            controller.abort();
            cancelButton.disabled = true;
            status.textContent = "Cancelling export...";
        }
    });

    syncControls();

})();
