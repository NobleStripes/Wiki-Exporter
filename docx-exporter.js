// Wiki Exporter v0.8.0 — native Word documents
const WikiDocx = (() => {
    function ensureReady() {
        if (!globalThis.docx?.Packer || !globalThis.docxHtml?.htmlToContent) {
            throw new Error("DOCX libraries are not loaded correctly.");
        }
    }

    function linkParagraph(label, value) {
        const { Paragraph, ExternalHyperlink, TextRun } = globalThis.docx;
        let url;
        try {
            const parsed = new URL(value);
            if (["https:", "http:"].includes(parsed.protocol)) url = parsed.href;
        } catch { /* Ordinary metadata, not a URL. */ }
        return new Paragraph({ children: [
            new TextRun({ text: `${label}: `, bold: true }),
            url ? new ExternalHyperlink({ link: url, children: [new TextRun({ text: value, style: "Hyperlink" })] })
                : new TextRun(String(value))
        ] });
    }

    // Keep the article readable if the HTML converter throws. This is an
    // explicitly reported fallback, not a lossless reconstruction.
    function fallbackText(html) {
        const template = document.createElement("template");
        template.innerHTML = html;
        const block = /^(p|div|h[1-6]|li|tr|ul|ol|table|section|aside|dl|dt|dd|blockquote|pre|figure|figcaption|caption)$/;
        function read(node) {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent;
            if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return "";
            if (node.localName === "br") return "\n";
            let text = [...node.childNodes].map(read).join("");
            if (["td", "th"].includes(node.localName)) return text + " | ";
            if (node.localName === "a" && node.getAttribute("href")) text += ` (${node.getAttribute("href")})`;
            return block.test(node.localName || "") ? `\n${text}\n` : text;
        }
        return read(template.content).split(/\n+/).map(s => s.trim()).filter(Boolean);
    }

    function articleToContent(article, pageBreak = false) {
        const { Paragraph, HeadingLevel } = globalThis.docx;
        const prepared = article.prepared || WikiFidelity.prepare(article);
        const warnings = [];
        let body;
        try {
            body = globalThis.docxHtml.htmlToContent(prepared.html, {
                baseUrl: article.url,
                onWarning: warning => warnings.push(String(warning?.message || warning))
            });
            if (!Array.isArray(body) || !body.length) throw new Error("Converter returned no content.");
        } catch (error) {
            warnings.push(`DOCX conversion fallback: ${error.message}. Text retained; formatting may be lost.`);
            body = fallbackText(prepared.html).map(text => new Paragraph(text));
        }
        const children = [
            new Paragraph({ text: article.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: pageBreak }),
            ...WikiFidelity.metadata(article).map(([key, value]) => linkParagraph(key, value)),
            new Paragraph(""),
            ...body,
            new Paragraph({ text: "Conversion diagnostics", heading: HeadingLevel.HEADING_3 }),
            ...WikiFidelity.diagnostics({ ...article, prepared }, warnings).map(line => new Paragraph(line))
        ];
        return children;
    }

    async function createDocument(articles, summary = [], failures = []) {
        ensureReady();
        const { Document, Paragraph, HeadingLevel, Packer, TableOfContents } = globalThis.docx;
        const children = [];
        const combined = summary.length > 0;
        const hasTOC = combined && typeof TableOfContents === "function";
        if (combined) {
            children.push(new Paragraph({ text: summary[0].replace(/^#\s*/, ""), heading: HeadingLevel.TITLE }));
            for (const line of summary.slice(1)) children.push(new Paragraph(line));
            children.push(new Paragraph({ text: "Article index (source links)", heading: HeadingLevel.HEADING_2 }));
            for (const [i, article] of articles.entries()) children.push(linkParagraph(`${i + 1}. ${article.title}`, article.url));
            if (hasTOC) {
                children.push(new Paragraph("Update the table of contents in Word to calculate page numbers."));
                children.push(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }));
            } else {
                children.push(new Paragraph("Automatic TOC unavailable in this DOCX library build; the article index is retained."));
            }
        }
        for (const [i, article] of articles.entries()) {
            for (const element of articleToContent(article, i > 0 || combined)) children.push(element);
        }
        if (failures.length) {
            children.push(new Paragraph({ text: "Failed Articles", heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
            for (const failure of failures) children.push(new Paragraph(failure));
        }
        const title = combined ? summary[0].replace(/^#\s*/, "") : articles[0]?.title || "Wiki Export";
        const document = new Document({
            creator: "Wiki Exporter",
            title,
            description: "Research document generated by Wiki Exporter.",
            ...(hasTOC ? { features: { updateFields: true } } : {}),
            sections: [{ children }]
        });
        return await Packer.toBlob(document);
    }
    return { ensureReady, createDocument };
})();
