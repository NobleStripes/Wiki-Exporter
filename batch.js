
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

    let controller = null;

    // ========================================
    // Article selection
    // ========================================

    function getSelectedArticles() {
        const checkboxes = articleList.querySelectorAll(
            'input[type="checkbox"]:checked'
        );

        return [...new Set(
            [...checkboxes].map(box => box.value)
        )];
    }

    function syncControls() {

        const checkboxes = articleList.querySelectorAll(
            'input[type="checkbox"]'
        );

        const total = checkboxes.length;

        const selected = articleList.querySelectorAll(
            'input[type="checkbox"]:checked'
        ).length;

        const exporting = controller !== null;

        // Update selection counter.
        selectionCount.textContent =
            `${selected} of ${total} selected`;

        // Export controls.
        exportButton.disabled =
            exporting || selected === 0;

        cancelButton.disabled =
            !exporting;

        // Selection controls.
        selectAllButton.disabled =
            exporting || total === 0 || selected === total;

        selectNoneButton.disabled =
            exporting || selected === 0;
    }

    // ========================================
    // Article Selection Controls
    // ========================================

    function setAllArticles(checked) {

        if (controller) return;

        const checkboxes = articleList.querySelectorAll(
            'input[type="checkbox"]'
        );

        checkboxes.forEach(box => {

            box.checked = checked;

        });

        syncControls();
    }

    // Select all articles.

    selectAllButton.addEventListener("click", () => {

        setAllArticles(true);

    });

    // Deselect all articles.

    selectNoneButton.addEventListener("click", () => {

        setAllArticles(false);

    });

    articleList.addEventListener("change", syncControls);

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
