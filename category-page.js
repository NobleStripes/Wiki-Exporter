// ========================================
// Wiki Exporter — Research Collection
// ========================================

const WikiCollection = (() => {

    const initialParams =
        new URLSearchParams(location.search);

    const controls =
        document.getElementById("collection-controls");

    const categoryInput =
        document.getElementById("category-url");

    const urlsInput =
        document.getElementById("article-urls");

    const articleList =
        document.getElementById("article-list");

    const subcategoryList =
        document.getElementById("subcategory-list");

    const clearButton =
        document.getElementById("clear-collection");

    const status =
        document.getElementById("status");

    const articles = new Map();
    const subcategories = new Map();
    const visitedCategories = new Set();

    let loading = false;
    let exporting = false;

    categoryInput.value =
        initialParams.get("url") || "";

    // ========================================
    // URL validation and normalization
    // ========================================

    function parseWikiURL(raw, category = false) {

        const url = new URL(raw.trim());

        if (
            url.protocol !== "https:" ||
            !url.hostname.endsWith(".fandom.com") ||
            !url.pathname.startsWith("/wiki/") ||
            url.username ||
            url.password ||
            url.port
        ) {
            throw new Error("Invalid Fandom wiki URL.");
        }

        // Do not silently convert historical revision
        // links or special actions into current articles.

        for (const key of url.searchParams.keys()) {

            if (
                key !== "so" &&
                !key.startsWith("utm_")
            ) {
                throw new Error(
                    "Unsupported URL parameters."
                );
            }
        }

        let title = decodeURIComponent(
            url.pathname.slice(6)
        ).replace(/[_\s]+/g, " ").trim();

        if (!title) {
            throw new Error("Missing article title.");
        }

        if (category) {

            if (!/^Category:/i.test(title)) {
                throw new Error(
                    "Enter a category URL."
                );
            }

            title = "Category:" +
                title.slice(title.indexOf(":") + 1).trim();

            if (title === "Category:") {
                throw new Error("Missing category name.");
            }

        } else {

            // Exclude common non-article namespaces.

            if (/^(Special|Category|File|Image|Media|Template|Module|User|User talk|Talk|Help|MediaWiki|Forum|Message Wall|Thread):/i.test(title)) {

                throw new Error(
                    "Not a supported article URL."
                );

            }
        }

        const normalizedURL =
            `${url.origin}/wiki/${
                encodeURIComponent(
                    title.replaceAll(" ", "_")
                )
            }`;

        return {
            url: normalizedURL,
            title,
            origin: url.origin,
            host: url.hostname
        };
    }

    // ========================================
    // Synchronize collection controls
    // ========================================

    function sync() {

        controls.disabled =
            loading || exporting;

        clearButton.disabled =
            articles.size === 0 &&
            subcategories.size === 0 &&
            visitedCategories.size === 0;

        document.dispatchEvent(
            new Event("collectionchange")
        );
    }

    async function runTask(task) {

        if (loading || exporting) return;

        loading = true;

        sync();

        try {

            await task();

        } catch (error) {

            status.textContent = error.message;

        } finally {

            loading = false;

            sync();
        }
    }

    // ========================================
    // Add unique article
    // ========================================

    function addArticle(
        rawUrl,
        title,
        source,
        selected = true
    ) {

        const entry = parseWikiURL(rawUrl);

        if (articles.has(entry.url)) {

            articles.get(entry.url)
                .sources.add(source);

            return false;
        }

        const label =
            document.createElement("label");

        label.dataset.title = title || entry.title;
        label.dataset.host = entry.host;

        const checkbox =
            document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.value = entry.url;
        checkbox.checked = selected;

        const details =
            document.createElement("span");

        details.className = "article-details";

        const articleTitle =
            document.createElement("span");

        articleTitle.className = "article-title";

        articleTitle.textContent =
            title || entry.title;

        const wikiName =
            document.createElement("small");

        wikiName.className = "article-wiki";
        wikiName.textContent = entry.host;

        details.append(articleTitle, wikiName);

        label.append(checkbox, details);

        articleList.appendChild(label);

        articles.set(entry.url, {
            ...entry,
            title: title || entry.title,
            sources: new Set([source])
        });

        return true;
    }

    // ========================================
    // Subcategory explorer
    // ========================================

    function addSubcategory(member) {

        const category = parseWikiURL(
            member.url,
            true
        );

        if (subcategories.has(category.url)) {
            return;
        }

        const button =
            document.createElement("button");

        button.type = "button";
        button.className = "secondary subcategory";

        button.textContent =
            `Load: ${member.title}`;

        button.disabled =
            visitedCategories.has(category.url);

        button.addEventListener("click", () => {

            runTask(() =>
                loadCategory(category.url)
            );

        });

        subcategories.set(
            category.url,
            button
        );

        subcategoryList.appendChild(button);
    }

    // ========================================
    // Load manually selected category
    // ========================================

    async function loadCategory(rawUrl) {

        const category =
            parseWikiURL(rawUrl, true);

        if (visitedCategories.has(category.url)) {

            status.textContent =
                "Category already loaded.";

            return;
        }

        const granted =
            await chrome.permissions.request({
                origins: [
                    `${category.origin}/*`
                ]
            });

        if (!granted) {
            throw new Error(
                "Permission not granted."
            );
        }

        status.textContent =
            `Loading ${category.title}...`;

        const members =
            await getCategoryMembers(category.url);

        let added = 0;
        let duplicates = 0;
        let skipped = 0;

        for (const member of members) {

            try {

                if (member.namespace === 0) {

                    const result = addArticle(
                        member.url,
                        member.title,
                        category.url
                    );

                    result ? added++ : duplicates++;

                } else if (member.namespace === 14) {

                    addSubcategory(member);

                }

            } catch {

                skipped++;

            }
        }

        visitedCategories.add(category.url);

        const categoryButton =
            subcategories.get(category.url);

        if (categoryButton) {

            categoryButton.disabled = true;

            categoryButton.textContent =
                `Loaded: ${category.title}`;
        }

        status.textContent =
            `${added} articles added, ` +
            `${duplicates} duplicates skipped, ` +
            `${skipped} unsupported entries. ` +
            `${articles.size} articles in collection.`;
    }

    // ========================================
    // Add pasted article URLs
    // ========================================

    function addPastedURLs() {

        const lines = urlsInput.value
            .split(/\r?\n/)
            .map(line => line.trim());

        let added = 0;
        let duplicates = 0;

        const invalid = [];

        lines.forEach((line, index) => {

            if (!line) return;

            try {

                const entry = parseWikiURL(line);

                const result = addArticle(
                    entry.url,
                    entry.title,
                    "Pasted URLs"
                );

                result ? added++ : duplicates++;

            } catch {

                invalid.push(index + 1);

            }

        });

        status.textContent =
            `${added} added, ` +
            `${duplicates} duplicates skipped.`;

        if (invalid.length) {

            status.textContent +=
                ` Invalid URL lines: ${invalid.join(", ")}.`;

        } else {

            urlsInput.value = "";

        }
    }

    // ========================================
    // Import open Fandom tabs
    // ========================================

    async function importOpenTabs() {

        const granted =
            await chrome.permissions.request({
                permissions: ["tabs"]
            });

        if (!granted) {
            throw new Error(
                "Browser tab permission not granted."
            );
        }

        let added = 0;

        try {

            const tabs = await chrome.tabs.query({

                currentWindow: true,

                url: "https://*.fandom.com/wiki/*"

            });

            for (const tab of tabs) {

                if (!tab.url) continue;

                try {

                    const entry =
                        parseWikiURL(tab.url);

                    const result = addArticle(
                        entry.url,
                        entry.title,
                        "Open browser tabs",
                        false
                    );

                    if (result) added++;

                } catch {

                    // Ignore unsupported pages.
                }
            }

            status.textContent =
                `${added} open articles added. ` +
                "Select the articles you want to export.";

        } finally {

            try {

                const removed =
                    await chrome.permissions.remove({
                        permissions: ["tabs"]
                    });

                if (!removed) {

                    status.textContent +=
                        " Tab permission could not be revoked.";
                }

            } catch {

                status.textContent +=
                    " Check extension tab permissions.";
            }
        }
    }

    // ========================================
    // Collection metadata
    // ========================================

    function describe(selectedURLs) {

        const sources = new Set();

        selectedURLs.forEach(url => {

            const entry = articles.get(url);

            entry?.sources.forEach(source =>
                sources.add(source)
            );

        });

        const sourceList = [...sources];

        let name = "Research Collection";

        if (
            sourceList.length === 1 &&
            sourceList[0].startsWith("https:")
        ) {

            const category = parseWikiURL(
                sourceList[0],
                true
            );

            name = category.title
                .replace(/^Category:/, "");

        }

        return {
            name,
            sources: sourceList
        };
    }

    // ========================================
    // Clear collection
    // ========================================

    function clearCollection() {

        if (loading || exporting) return;

        articles.clear();
        subcategories.clear();
        visitedCategories.clear();

        articleList.replaceChildren();
        subcategoryList.replaceChildren();

        urlsInput.value = "";

        status.textContent =
            "Collection cleared.";

        sync();
    }

    // ========================================
    // Event listeners
    // ========================================

    document.getElementById("load-category")
        .addEventListener("click", () => {

            runTask(() =>
                loadCategory(categoryInput.value)
            );

        });

    document.getElementById("add-urls")
        .addEventListener("click", () => {

            runTask(addPastedURLs);

        });

    document.getElementById("load-tabs")
        .addEventListener("click", () => {

            runTask(importOpenTabs);

        });

    clearButton.addEventListener(
        "click",
        clearCollection
    );

    return {

        parseArticle: raw =>
            parseWikiURL(raw),

        describe,

        get busy() {
            return loading;
        },

        setExporting(value) {

            exporting = value;

            sync();

        }
    };

})();
