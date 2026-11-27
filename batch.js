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
    const collectionTitle = document.getElementById("collection-title");
    const archiveOptions = document.getElementById("archive-options");
    const previewExport = document.getElementById("preview-export");
    const combinedManifest = document.getElementById("combined-manifest");
    const linkModeSelect = document.getElementById("link-mode");
    const mediaModeSelect = document.getElementById("media-mode");

    const selectAllButton =
        document.getElementById("select-all");

    const selectNoneButton =
        document.getElementById("select-none");

    const selectionCount =
        document.getElementById("selection-count");

    const searchInput =
        document.getElementById("article-search");

    const searchMode =
        document.getElementById("search-mode");

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

    const selectedOnly =
        document.getElementById("selected-only");

    const clearSearchButton =
        document.getElementById("clear-search");

    const invertButton =
        document.getElementById("invert-selection");

    const searchError =
        document.getElementById("search-error");

    const collator = new Intl.Collator(undefined, {
        sensitivity: "base",
        numeric: true
    });

    let controller = null;

    // ========================================
    // Advanced Article Search
    // ========================================

    function getSearch() {

        return WikiSearch.compile(
            searchInput.value,
            searchMode.value
        );
    }

    function scoreRow(row, query) {

        return query.score(

            row.dataset.title ||
            row.textContent.trim(),

            row.dataset.host || ""

        );
    }

    function buildSearchView() {

        const query = getSearch();

        const rows = [
            ...articleList.querySelectorAll("label")
        ];

        const scores = new Map(
            rows.map(row => [
                row,
                scoreRow(row, query)
            ])
        );

        rows.sort((a, b) => {

            if (sortSelect.value === "relevance") {

                const difference =
                    (scores.get(b) ?? -1) -
                    (scores.get(a) ?? -1);

                if (difference !== 0) {
                    return difference;
                }
            }

            const direction =
                sortSelect.value === "desc" ? -1 : 1;

            return direction * collator.compare(

                a.dataset.title ||
                a.textContent.trim(),

                b.dataset.title ||
                b.textContent.trim()

            );
        });

        return { query, rows, scores };
    }

    function getArticleRows() {

        return buildSearchView().rows;
    }

    // ========================================
    // Selected Article URLs
    // ========================================

    function getSelectedArticles(
        rows = getArticleRows()
    ) {

        const selected = rows
            .map(row =>
                row.querySelector(
                    'input[type="checkbox"]'
                )
            )
            .filter(box => box?.checked)
            .map(box => box.value);

        return [...new Set(selected)];
    }

    // ========================================
    // Apply Search and Review Mode
    // ========================================

    function applyArticleView(
        view = buildSearchView()
    ) {

        const { query, rows, scores } = view;

        rows.forEach((row, index) => {

            const checked = row.querySelector(
                'input[type="checkbox"]'
            )?.checked;

            if (selectedOnly.checked) {

                // Review all selected articles,
                // independently of the search query.

                row.hidden = !checked;

            } else if (query.error) {

                // Invalid syntax must not erase
                // the existing selection.

                row.hidden = false;

            } else {

                row.hidden = scores.get(row) === null;

            }

            row.style.order = index;
        });

        searchError.hidden = !query.error;

        searchError.textContent =
            query.error || "";

        searchInput.setAttribute(
            "aria-invalid",
            String(Boolean(query.error))
        );

        return rows;
    }

    // ========================================
    // Synchronize Controls
    // ========================================

    function syncControls() {

        const view = buildSearchView();

        const rows = applyArticleView(view);

        const visibleRows = rows.filter(
            row => !row.hidden
        );

        const total = rows.length;

        const selected =
            getSelectedArticles(rows).length;

        const visibleSelected = visibleRows.filter(
            row => row.querySelector("input")?.checked
        ).length;

        const hiddenSelected =
            selected - visibleSelected;

        const exporting = controller !== null;

        const locked =
            exporting || WikiCollection.busy;

        const overLimit =
            selected > WikiRequest.MAX_BATCH;

        // Selection statistics.

        selectionCount.textContent =
            `${visibleRows.length} visible · ` +
            `${selected} of ${total} selected`;

        if (hiddenSelected > 0) {

            selectionCount.textContent +=
                ` · ${hiddenSelected} selected outside view`;
        }

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

        // Empty results message.

        filterEmpty.hidden =
            total === 0 ||
            visibleRows.length > 0 ||
            Boolean(view.query.error);

        filterEmpty.textContent =
            selectedOnly.checked

                ? "No selected articles."

                : "No matching articles.";

        // Export controls.

        exportButton.disabled =
            locked ||
            selected === 0 ||
            overLimit ||
            Boolean(view.query.error);

        cancelButton.disabled =
            !exporting ||
            controller.signal.aborted;

        // Global selection.

        selectAllButton.disabled =
            locked ||
            total === 0 ||
            selected === total;

        selectNoneButton.disabled =
            locked ||
            selected === 0;

        invertButton.disabled =
            locked ||
            total === 0;

        // Filtered selection.

        selectFilteredButton.disabled =
            locked ||
            Boolean(view.query.error) ||
            visibleRows.length === 0 ||
            visibleSelected === visibleRows.length;

        deselectFilteredButton.disabled =
            locked ||
            Boolean(view.query.error) ||
            visibleSelected === 0;

        // Search controls.

        searchInput.disabled =
            locked || total === 0;

        searchMode.disabled =
            locked || total === 0;

        sortSelect.disabled =
            locked || total === 0;

        selectedOnly.disabled =
            locked || total === 0;

        clearSearchButton.disabled =
            locked ||
            (!searchInput.value &&
                !selectedOnly.checked);

        // Prevent selection changes during extraction
        // or collection loading.

        rows.forEach(row => {

            const checkbox = row.querySelector(
                'input[type="checkbox"]'
            );

            if (checkbox) {
                checkbox.disabled = locked;
            }
        });

        formatOptions.disabled = exporting;
        archiveOptions.disabled = locked;
        combinedManifest.disabled = locked || outputOptions.querySelector('input[name="output-mode"]:checked')?.value !== "combined";
        outputOptions.disabled = exporting;
        collectionTitle.disabled = locked;
    }

    // ========================================
    // Bulk Selection
    // ========================================

    function setArticlesChecked(
        checked,
        filteredOnly = false
    ) {

        if (controller || WikiCollection.busy) return;

        for (const row of getArticleRows()) {

            if (filteredOnly && row.hidden) {
                continue;
            }

            const checkbox = row.querySelector(
                'input[type="checkbox"]'
            );

            if (checkbox) {

                checkbox.checked =
                    checked === "invert"

                        ? !checkbox.checked

                        : checked;
            }
        }

        syncControls();
    }

    // ========================================
    // Automatic Keyword Selection
    // ========================================

    function selectSearchMatches(
        rows = articleList.querySelectorAll("label")
    ) {

        if (controller) return;

        const query = getSearch();

        // Preserve selections when clearing search
        // or typing an incomplete expression.

        if (query.empty || query.error) return;

        for (const row of rows) {

            const checkbox = row.querySelector(
                'input[type="checkbox"]'
            );

            if (checkbox) {

                checkbox.checked =
                    scoreRow(row, query) !== null;

            }
        }
    }

    // ========================================
    // Selection Event Listeners
    // ========================================

    selectAllButton.addEventListener(
        "click",
        () => setArticlesChecked(true)
    );

    selectNoneButton.addEventListener(
        "click",
        () => setArticlesChecked(false)
    );

    selectFilteredButton.addEventListener(
        "click",
        () => setArticlesChecked(true, true)
    );

    deselectFilteredButton.addEventListener(
        "click",
        () => setArticlesChecked(false, true)
    );

    invertButton.addEventListener(
        "click",
        () => setArticlesChecked("invert")
    );

    // ========================================
    // Search Event Listeners
    // ========================================

    searchInput.addEventListener("input", () => {

        selectedOnly.checked = false;

        selectSearchMatches();

        syncControls();

    });

    searchMode.addEventListener("change", () => {

        WikiSettings.set(
            "searchMode",
            searchMode.value
        );

        selectedOnly.checked = false;

        selectSearchMatches();

        syncControls();

    });

    sortSelect.addEventListener("change", () => {

        WikiSettings.set(
            "sort",
            sortSelect.value
        );

        syncControls();

    });

    selectedOnly.addEventListener(
        "change",
        syncControls
    );

    clearSearchButton.addEventListener("click", () => {

        searchInput.value = "";

        selectedOnly.checked = false;

        // Clearing search changes visibility,
        // not the selected articles.

        syncControls();

        searchInput.focus();

    });

    articleList.addEventListener(
        "change",
        syncControls
    );

    document.addEventListener(
        "collectionchange",
        syncControls
    );

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

        searchMode.value =
            WikiSettings.get("searchMode");

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
    linkModeSelect.value = WikiSettings.get("linkMode");
    mediaModeSelect.value = WikiSettings.get("mediaMode");
    mediaModeSelect.addEventListener("change",()=>WikiSettings.set("mediaMode",mediaModeSelect.value));
    linkModeSelect.addEventListener("change",()=>WikiSettings.set("linkMode",linkModeSelect.value));
    document.addEventListener("collectionrestored", () => {
        syncOutputLabels();
        syncControls();
    });
    outputOptions.addEventListener("change", syncControls);


    new MutationObserver(records => {

        if (!controller) {

            const addedRows = records
                .flatMap(record => [...record.addedNodes])
                .filter(node =>
                    node.nodeType === Node.ELEMENT_NODE &&
                    node.matches("label") &&
                    node.parentElement === articleList &&
                    node.dataset.restoreSelection !== "true"
                );

            // Apply the current keyword filter only
            // to newly imported articles.

            if (addedRows.length) {

                selectSearchMatches(addedRows);

            }

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

    async function fetchArticle(articleUrl, signal) {

        const entry =
            WikiCollection.parseArticle(articleUrl);

        const url = new URL(entry.url);

        const page = entry.title;

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
            url: WikiCollection.parseArticle(sourceUrl).url,
            pageId: parsed.pageid,
            revision: parsed.revid,
            html: html
        };
    }

    // Content preparation and Markdown conversion now live in fidelity.js.

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

        const activeQuery = getSearch();

        if (activeQuery.error) {

            status.textContent =
                "Correct or clear the search expression before exporting.";

            return;
        }

        if (controller || WikiCollection.busy) return;

        const articles = getSelectedArticles();
        const outputMode = outputOptions.querySelector(
            'input[name="output-mode"]:checked'
        )?.value || "combined";

        const exportFormat = formatOptions.querySelector(
            'input[name="export-format"]:checked'
        )?.value || "md";

        const requestedLinkMode = WikiLinks.normalize(linkModeSelect.value);
        const linkMode = WikiLinks.effective(requestedLinkMode,exportFormat);
        const mediaMode = WikiMedia.normalize(mediaModeSelect.value);

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

        const context =
            WikiCollection.describe(articles);

        const categoryName = collectionTitle.value.trim() || context.name;

        controller = new AbortController();
        WikiCollection.setExporting(true);

        const signal = controller.signal;
        const completed = [];
        const failed = [];
        const seenPages = new Set();
        const licenseCache = new Map();

        let duplicates = 0;

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

            const origins = [...new Set(

                articles.map(articleUrl => {

                    const entry =
                        WikiCollection.parseArticle(articleUrl);

                    return `${entry.origin}/*`;

                })

            )];

            const granted =
                await chrome.permissions.request({
                    origins
                });

            if (!granted) {

                throw new Error(
                    "Permission not granted for selected wikis."
                );
            }

            signal.throwIfAborted();

            if (exportFormat === "docx") {
                WikiDocx.ensureReady();
            }

            const converter = exportFormat === "md"
                ? WikiFidelity.createMarkdownConverter()
                : null;

            for (let i = 0; i < articles.length; i++) {

                if (signal.aborted) break;

                status.textContent =
                    `Extracting article ${i + 1} of ${articles.length}...`;

                try {

                    const article = await fetchArticle(
                        articles[i],
                        signal
                    );

                    const identity = article.pageId > 0
                        ? `${new URL(article.url).origin}:${article.pageId}`
                        : article.url;

                    if (seenPages.has(identity)) {

                        duplicates++;
                        // Remember only aliases resolved by the successful article request.
                        const existing = completed.find(a => (a.pageId > 0
                            ? `${new URL(a.url).origin}:${a.pageId}` : a.url) === identity);
                        if (existing) existing.aliases.push(articles[i]);

                    } else {

                        article.retrievedAt = new Date().toISOString();

                        // The existing request guard handles spacing, access errors and cooldowns.
                        // If metadata retrieval is interrupted, retain this already-fetched article.
                        let licenseIssue = "";
                        try {
                            article.license = await WikiFidelity.siteLicense(
                                new URL(article.url).origin, licenseCache, signal
                            );
                        } catch (error) {
                            article.license = null;
                            licenseIssue = signal.aborted
                                ? "License lookup cancelled."
                                : `License lookup stopped: ${error.message}`;
                            if (!signal.aborted) stopReason = licenseIssue;
                        }

                        article.mediaMode = mediaMode;
                        article.prepared = WikiFidelity.prepare(article);
                        if (licenseIssue) article.prepared.warnings.push(licenseIssue);
                        if (!article.prepared.hasText) {
                            throw new Error("Prepared article is empty.");
                        }
                        const preparedArticle = WikiLinks.apply({...article, aliases:[articles[i]]},linkMode);
                        completed.push({
                            ...preparedArticle,
                            markdown: exportFormat === "md"
                                ? WikiFidelity.markdown(preparedArticle, converter)
                                : null
                        });
                        seenPages.add(identity);
                        if (licenseIssue || signal.aborted) {
                            progress.value = i + 1;
                            break;
                        }
                    }

                } catch (error) {

                    if (signal.aborted) break;

                    failed.push({
                        url: articles[i],
                        reason: error.message
                    });

                    if (error.stopBatch || stopReason) {
                        stopReason = error.message;
                        progress.value = i + 1;
                        break;
                    }
                }

                progress.value = i + 1;
            }

            const unprocessed =
                articles.length -
                completed.length -
                failed.length -
                duplicates;

            let partial =
                signal.aborted ||
                Boolean(stopReason) ||
                failed.length > 0 ||
                unprocessed > 0;

            const summary = [

                `# Wiki Export: ${categoryName}`,

                ...context.sources.map(
                    source => `Collection source: ${source}`
                ),

                `Selected articles: ${articles.length}`,

                `Successfully extracted: ${completed.length}`,

                `Duplicate articles skipped: ${duplicates}`,

                `Failed: ${failed.length}`,

                `Unprocessed: ${unprocessed}`,

                `Export status: ${partial ? "Partial" : "Complete"}`,
                ...(stopReason ? [`Stop reason: ${stopReason}`] : [])

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
                const archiveInfo = {
                    collection: categoryName, sources: context.sources,
                    status: partial ? "partial" : "complete", selected: articles.length,
                    duplicates, unprocessed, stopReason: stopReason || null, failed,
                    requestedLinkMode, linkMode, mediaMode
                };
                summary.push(`Body links: ${WikiLinks.labels[linkMode]}${requestedLinkMode !== linkMode ? " (HTML-only option falls back to retain)" : ""}`);
                // Preview is local and uses the same prepared content as the export.
                cancelButton.disabled = true;
                if (previewExport.checked) {
                    status.textContent = "Review prepared articles before downloading.";
                    if (!await WikiArchive.review(completed, summary, exportFormat, outputMode)) {
                        status.textContent = "Export discarded. No download requested.";
                        return;
                    }
                }
                const safeName = categoryName
                    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
                    .trim().slice(0,120) || "Collection";
                const base = () => `Wiki_${safeName}${partial ? "_partial" : ""}`;
                status.textContent = `Generating ${exportFormat.toUpperCase()} export...`;
                let count = completed.length;

                if (outputMode === "combined") {
                    const manifestData = WikiArchive.manifest(completed,archiveInfo);
                    summary.push(`Approximate body word count: ${manifestData.approximateWords}`);
                    const blob = await WikiArchive.build(completed,exportFormat,summary,failures,archiveInfo);
                    if (combinedManifest.checked) {
                        const zip = new JSZip();
                        zip.file(`${base()}.${exportFormat}`,blob);
                        zip.file("export_manifest.json",JSON.stringify(manifestData,null,2));
                        const result = await zip.generateAsync({type:"blob",compression:"DEFLATE"});
                        downloadFile(result,`${base()}.zip`);
                    } else {
                        downloadFile(blob,`${base()}.${exportFormat}`);
                    }
                } else {
                    const zip = new JSZip();
                    const folder = zip.folder("articles");
                    const packaged = [];
                    const packagingFailures = [];
                    const names = new Map();
                    const filenames = new Map(completed.map((article,index)=>[
                        article.url,WikiLinks.filename(article,index,exportFormat)
                    ]));
                    const local = exportFormat === "html" && linkMode === "local";
                    const plan = local ? WikiArchive.localPlan(completed,filenames) : null;
                    for (const [index, article] of completed.entries()) {
                        const filename = filenames.get(article.url);
                        status.textContent = `Generating file ${index+1} of ${completed.length}...`;
                        try {
                            folder.file(filename, await WikiArchive.build([article],exportFormat,[],[],{requestedLinkMode,linkMode},plan));
                            packaged.push(article);
                            names.set(article.url,`articles/${filename}`);
                        } catch(error) {
                            packagingFailures.push({url:article.url,reason:error.message});
                        }
                    }
                    // If a local HTML target failed, rebuild survivors against the final set.
                    // Repeat only local conversion (never another network request).
                    if (local && packagingFailures.length) {
                        let changed;
                        do {
                            changed = false;
                            const finalPlan = WikiArchive.localPlan(packaged,filenames);
                            for (const article of [...packaged]) {
                                const filename=filenames.get(article.url);
                                try {
                                    folder.file(filename,await WikiArchive.build([article],exportFormat,[],[],{requestedLinkMode,linkMode},finalPlan));
                                } catch(error) {
                                    folder.remove(filename);
                                    packaged.splice(packaged.indexOf(article),1);
                                    names.delete(article.url);
                                    packagingFailures.push({url:article.url,reason:error.message});
                                    changed=true;
                                }
                            }
                        } while(changed && packaged.length);
                    }
                    count = packaged.length;
                    if (packagingFailures.length) {
                        partial = true;
                        summary.push(`File generation failures: ${packagingFailures.length}`);
                        const index = summary.findIndex(line=>line.startsWith("Export status:"));
                        if(index >= 0) summary[index] = "Export status: Partial";
                        report.hidden = false;
                        report.textContent += "\nFile generation failures:\n" + packagingFailures.map(e=>`${e.url}: ${e.reason}`).join("\n");
                    }
                    const manifestData = WikiArchive.manifest(packaged,{
                        ...archiveInfo,status:partial?"partial":"complete",packagingFailures
                    });
                    manifestData.articles.forEach(a=>a.file=names.get(a.url));
                    const manifest = [...summary,"",`Files generated: ${count}`,"","## Exported Articles",...packaged.map(a=>`- ${names.get(a.url)}: ${a.url}`),
                        ...(failures.length?["","## Retrieval failures",...failures]:[]),
                        ...(packagingFailures.length?["","## File generation failures",...packagingFailures.map(e=>`- ${e.url}: ${e.reason}`)]:[])];
                    zip.file(exportFormat === "md" ? "export_report.md" : "export_report.txt",manifest.join("\n"));
                    zip.file("export_manifest.json",JSON.stringify(manifestData,null,2));
                    const result = await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}},metadata=>{
                        status.textContent = `Creating ZIP: ${metadata.percent.toFixed(0)}%`;
                    });
                    downloadFile(result,`${base()}.zip`);
                }
                WikiArchive.log(exportFormat,outputMode,count,partial);
                document.dispatchEvent(new Event("exporthistorychange"));
                const result = signal.aborted ? "Export cancelled; partial download requested." : stopReason ? `Export stopped: ${stopReason}.` : partial ? "Partial export download requested." : "Export download requested.";
                status.textContent = `${result} ${count} article file(s)/entries, ${duplicates} duplicates skipped, ${failed.length} retrieval failures, ${unprocessed} unprocessed.`;
                return;
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

            status.textContent = signal.aborted
                ? "Export cancelled."
                : error.message;

        } finally {

            controller = null;
            WikiCollection.setExporting(false);
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
