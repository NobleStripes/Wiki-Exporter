// Wiki Exporter v0.8.0 — shared research document preparation
const WikiFidelity = (() => {
    const LICENSE_UNKNOWN = "Unverified — consult the original source.";
    const CLUTTER = `script,style,iframe,object,embed,form,button,input,textarea,select,
        audio,video,source,svg,math,canvas,noscript,template,link,meta,base,frame,.mw-editsection,.wikia-ad,.toc`;
    const SAFE_TAGS = new Set((`table thead tbody tfoot tr th td caption colgroup col p br a strong em b i u s del code pre ul ol li sup sub blockquote span div h1 h2 h3 h4 h5 h6 dl dt dd figure figcaption hr`).split(/\s+/));

    function httpURL(value, base) {
        try {
            if (typeof value !== "string" || !value.trim()) return null;
            const u = new URL(value, base);
            return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : null;
        } catch { return null; }
    }

    function rights(text, url, source) {
        const link = httpURL(url);
        const name = typeof text === "string" ? text.trim() : "";
        return name || link ? { text: name || link, url: link, source } : null;
    }

    async function siteLicense(origin, cache, signal) {
        if (cache.has(origin)) return cache.get(origin);
        const data = await WikiRequest.getJSON(origin, new URLSearchParams({
            action: "query", meta: "siteinfo", siprop: "rightsinfo", formatversion: "2"
        }), signal);
        const r = data.query?.rightsinfo;
        const result = rights(r?.text, httpURL(r?.url, origin), "Wiki-declared site license (API)");
        cache.set(origin, result);
        return result;
    }

    function revisionURL(article) {
        const id = String(article.revision ?? "");
        return /^[1-9]\d*$/.test(id) ? `${new URL(article.url).origin}/wiki/Special:PermanentLink/${id}` : null;
    }

    function metadata(article) {
        const history = new URL(article.url);
        history.hash = "";
        history.search = "";
        history.searchParams.set("action", "history");
        const rev = revisionURL(article);
        const license = article.license;
        return [
            ["Source", article.url],
            ["Contributors", "Original wiki contributors; see article history"],
            ["Article history", history.href],
            ["Revision ID", rev ? String(article.revision) : "Unavailable"],
            ...(rev ? [["Permanent revision", rev]] : []),
            ["Retrieved", article.retrievedAt || new Date().toISOString()],
            ["License", license?.text || LICENSE_UNKNOWN],
            ...(license?.url ? [["License URL", license.url]] : []),
            ...(license?.source ? [["License evidence", license.source]] : []),
            ...(article.linkMode ? [["Body link policy", article.linkMode === "local" ? "Local HTML navigation where targets exist" : article.linkMode === "wiki" ? "Strip ordinary wiki links" : article.linkMode === "inline" ? "Strip ordinary inline links" : "Retain links"]] : []),
            ["Changes", "Reformatted by Wiki Exporter; website interface elements removed; images represented by links or descriptions."],
            ["Rights note", "The declared wiki license may not cover third-party text or media; verify the original source before redistribution."]
        ];
    }

    function isComplexTable(table) {
        if (table.querySelector("table, [rowspan], [colspan], caption, colgroup")) return true;
        const rows = [...table.rows];
        if (!rows.length || !rows[0].cells.length) return true;
        if (![...rows[0].cells].every(cell => cell.tagName === "TH")) return true;
        const count = rows[0].cells.length;
        return rows.some((row, index) => row.cells.length !== count ||
            [...row.cells].some(cell => (index > 0 && cell.tagName === "TH") ||
                cell.querySelector("ul,ol,dl,p,div,br,pre,blockquote,figure,h1,h2,h3,h4,h5,h6")));
    }

    // Only used for raw HTML Markdown table fallback. No event handlers,
    // styles, embedded resources, or unrecognized elements survive this copy.
    function safeTableHTML(table) {
        const shell = document.createElement("template");
        function copy(node, parent) {
            if (node.nodeType === Node.TEXT_NODE) {
                parent.append(document.createTextNode(node.textContent));
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const tag = node.localName;
            if (!SAFE_TAGS.has(tag)) {
                for (const child of node.childNodes) copy(child, parent);
                return;
            }
            const el = document.createElement(tag);
            if (tag === "a") {
                const href = httpURL(node.getAttribute("href"));
                if (href) el.setAttribute("href", href);
            }
            if (node.hasAttribute("title")) el.setAttribute("title", node.getAttribute("title"));
            for (const attr of ["rowspan", "colspan", "span", "start", "value"]) {
                const value = node.getAttribute(attr);
                if (value && /^\d{1,4}$/.test(value) && ["th", "td", "col", "colgroup", "ol", "li"].includes(tag)) el.setAttribute(attr, value);
            }
            for (const child of node.childNodes) copy(child, el);
            parent.append(el);
        }
        copy(table, shell.content);
        return shell.innerHTML;
    }

    // Convert only simple, recognizable portable infobox rows. Leave any
    // ambiguous row in place, including its original text and markup.
    function convertInfoboxes(root, stats) {
        for (const box of root.querySelectorAll(".portable-infobox")) {
            for (const row of [...box.querySelectorAll(".pi-data")]) {
                if (!row.parentNode || row.closest(".portable-infobox") !== box) continue;
                const label = row.querySelector(":scope > .pi-data-label");
                const value = row.querySelector(":scope > .pi-data-value");
                const extra = [...row.childNodes].some(n => n !== label && n !== value &&
                    (n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent.trim())));
                if (!label || !value || extra) continue;
                let table = row.previousElementSibling;
                const precedingText = row.previousSibling;
                const canAppend = table?.matches('table[data-wiki-export-infobox]') &&
                    !(precedingText?.nodeType === Node.TEXT_NODE && precedingText.textContent.trim());
                if (!canAppend) {
                    table = document.createElement("table");
                    table.dataset.wikiExportInfobox = "true";
                    const header = table.createTHead().insertRow();
                    for (const name of ["Field", "Value"]) {
                        const th = document.createElement("th");
                        th.textContent = name;
                        header.append(th);
                    }
                    table.createTBody();
                    row.before(table);
                }
                const tr = table.tBodies[0].insertRow();
                const labelCell = tr.insertCell();
                const valueCell = tr.insertCell();
                const bold = document.createElement("strong");
                // Move, rather than reduce to textContent, to preserve links and formatting.
                bold.append(...label.childNodes);
                labelCell.append(bold);
                valueCell.append(...value.childNodes);
                row.remove();
                stats.infoboxRowsConverted++;
            }
        }
    }

    function prepare(article) {
        const template = document.createElement("template");
        template.innerHTML = article.html;
        const root = template.content.querySelector(".mw-parser-output") || template.content;
        const stats = {
            headings: root.querySelectorAll("h1,h2,h3,h4,h5,h6").length,
            infoboxes: root.querySelectorAll(".portable-infobox").length,
            infoboxRows: root.querySelectorAll(".portable-infobox .pi-data").length,
            infoboxRowsConverted: 0,
            originalTables: root.querySelectorAll("table").length,
            referenceEntries: root.querySelectorAll("ol.references > li, ul.references > li").length,
            referenceMarkers: root.querySelectorAll("sup.reference").length,
            images: root.querySelectorAll("img").length,
            imagesWithURL: 0,
            removedElements: 0,
            complexTables: 0
        };
        const warnings = [];
        // Retain readable fallback text for selected unsupported content.
        for (const el of [...root.querySelectorAll(CLUTTER)]) {
            if (!root.contains(el)) continue;
            if (["math", "svg", "canvas", "audio", "video"].includes(el.localName)) {
                const text = el.getAttribute("aria-label") || el.textContent.trim();
                const replacement = document.createElement("span");
                replacement.textContent = text || `[Unsupported ${el.localName} content — see source]`;
                el.replaceWith(replacement);
                warnings.push(`Unsupported ${el.localName} content represented as text.`);
            } else {
                el.remove();
            }
            stats.removedElements++;
        }

        const source = new URL(article.url);
        const revision = revisionURL(article);
        for (const link of root.querySelectorAll("a[href]")) {
            const href = httpURL(link.getAttribute("href"), article.url);
            if (!href) { link.removeAttribute("href"); continue; }
            const target = new URL(href);
            if (revision && target.origin === source.origin &&
                target.pathname === source.pathname && target.hash &&
                [...target.searchParams].every(([key,value]) =>
                    key === "so" || key.startsWith("utm_") ||
                    (key === "oldid" && value === String(article.revision)))) {
                link.setAttribute("href", revision + target.hash);
            } else link.setAttribute("href", href);
        }

        // Represent images by source links rather than fetching or embedding bytes.
        for (const image of [...root.querySelectorAll("img")]) {
            const href = httpURL(image.getAttribute("data-src"), article.url) || httpURL(image.getAttribute("src"), article.url);
            const description = image.getAttribute("alt") || image.getAttribute("title") || "Image";
            const link = document.createElement(href && !image.closest("a") ? "a" : "span");
            link.textContent = `[Image: ${description}${href && image.closest("a") ? `; ${href}` : ""}]`;
            if (href) {
                stats.imagesWithURL++;
                if (link.localName === "a") link.setAttribute("href", href);
            }
            image.replaceWith(link);
        }

        convertInfoboxes(root, stats);
        stats.preparedTables = root.querySelectorAll("table").length;
        stats.complexTables = [...root.querySelectorAll("table")].filter(isComplexTable).length;
        if (stats.infoboxRowsConverted < stats.infoboxRows) warnings.push("Some portable infobox rows could not be safely converted; original markup retained for conversion.");
        if (stats.complexTables) warnings.push("Complex or headerless tables: Markdown preserves safe HTML; Word formatting may differ from the source.");
        if (stats.images) warnings.push("Images are represented by links or descriptions; image bytes are not included.");
        if (stats.imagesWithURL < stats.images) warnings.push("Some images lack a usable HTTP(S) source URL.");
        if (!article.license) warnings.push("Source license not verified.");
        if (!revision) warnings.push("Revision ID unavailable; permanent revision link not generated.");

        // Strip active attributes before any converter sees the result.
        for (const el of root.querySelectorAll("*")) {
            for (const attr of [...el.attributes]) {
                if (/^on/i.test(attr.name) || ["srcdoc", "style", "srcset", "ping", "background", "formaction", "autofocus"].includes(attr.name.toLowerCase())) el.removeAttribute(attr.name);
            }
        }
        const html = root.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? template.innerHTML : root.innerHTML;
        const hasText = root.textContent.trim().length > 0;
        if (!hasText) warnings.push("Prepared article has no readable text.");
        return { html, stats, warnings: [...new Set(warnings)], hasText };
    }

    function createMarkdownConverter() {
        const converter = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
        converter.use(turndownPluginGfm.gfm);
        converter.addRule("wikiComplexTable", {
            filter: node => node.nodeName === "TABLE" && isComplexTable(node),
            replacement: (_content, node) => `\n\n${safeTableHTML(node)}\n\n`
        });
        return converter;
    }

    function diagnostics(article, extra = []) {
        const s = article.prepared?.stats || {};
        return [
            `Detected headings: ${s.headings ?? 0}; reference entries: ${s.referenceEntries ?? 0}; citation markers: ${s.referenceMarkers ?? 0}.`,
            `Portable infobox rows converted: ${s.infoboxRowsConverted ?? 0}/${s.infoboxRows ?? 0}; original tables: ${s.originalTables ?? 0}; prepared tables: ${s.preparedTables ?? 0}; complex tables: ${s.complexTables ?? 0}.`,
            `Images with usable URLs: ${s.imagesWithURL ?? 0}/${s.images ?? 0}.`,
            ...new Set([...(article.prepared?.warnings || []), ...extra]),
            "Counts describe detected source/prepared elements, not verified output completeness."
        ];
    }

    function mdEscape(text) {
        return String(text ?? "").replace(/[\\`*_[\]<>]/g, "\\$&").replace(/\r?\n/g, " ");
    }

    function mdURL(url) {
        return `<${String(url).replace(/>/g, "%3E")}>`;
    }

    function markdown(article, converter) {
        const prepared = article.prepared || prepare(article);
        const body = converter.turndown(prepared.html);
        if (!body.trim()) throw new Error("Converted article is empty.");
        return [
            `# ${mdEscape(article.title)}`,
            ...metadata(article).map(([key, value]) => `${key}: ${httpURL(value) ? mdURL(value) : mdEscape(value)}`),
            body,
            "## Conversion diagnostics",
            diagnostics({ ...article, prepared }).map(line => `- ${mdEscape(line)}`).join("\n")
        ].join("\n\n");
    }

    function articleIndex(articles) {
        return ["## Article index", "", ...articles.map((a, i) => `${i + 1}. [${mdEscape(a.title)}](${mdURL(a.url)})`)].join("\n");
    }

    return { rights, siteLicense, metadata, revisionURL, prepare, createMarkdownConverter, markdown, diagnostics, articleIndex };
})();
