
// ========================================
// Wiki Exporter — DOCX Export Engine
// ========================================

const WikiDocx = (() => {

    function ensureReady() {

        if (
            !globalThis.docx?.Packer ||
            !globalThis.docxHtml?.htmlToContent
        ) {
            throw new Error(
                "DOCX libraries are not loaded correctly."
            );
        }
    }

    // ========================================
    // Prepare article HTML
    // ========================================

    function prepareHtml(article) {

        const template = document.createElement("template");

        template.innerHTML = article.html;

        const content = template.content;

        content.querySelectorAll(`
            script,
            style,
            iframe,
            object,
            embed,
            button,
            .mw-editsection,
            .wikia-ad,
            .toc
        `).forEach(element => element.remove());

        // Preserve hyperlinks.

        content.querySelectorAll("a[href]")
            .forEach(link => {

                try {

                    const url = new URL(
                        link.getAttribute("href"),
                        article.url
                    );

                    if (["https:", "http:"].includes(url.protocol)) {
                        link.setAttribute("href", url.href);
                    } else {
                        link.removeAttribute("href");
                    }

                } catch {
                    link.removeAttribute("href");
                }

            });

        // Represent images as links.
        // No additional image downloads.

        content.querySelectorAll("img")
            .forEach(image => {

                const source =
                    image.getAttribute("data-src") ||
                    image.getAttribute("src");

                const label =
                    image.getAttribute("alt") || "Image";

                const replacement =
                    document.createElement("a");

                replacement.textContent =
                    `[Image: ${label}]`;

                try {

                    const url = new URL(
                        source || "",
                        article.url
                    );

                    if (
                        source &&
                        ["https:", "http:"].includes(url.protocol)
                    ) {
                        replacement.href = url.href;
                    }

                } catch {
                    // Retain the image description.
                }

                if (image.closest("a")) {
                    image.replaceWith(
                        document.createTextNode(
                            replacement.textContent
                        )
                    );
                } else {
                    image.replaceWith(replacement);
                }

            });

        return template.innerHTML;
    }

    // ========================================
    // Convert an article to Word content
    // ========================================

    function articleToContent(article, pageBreak = false) {

        const {
            Paragraph,
            HeadingLevel,
            ExternalHyperlink,
            TextRun
        } = globalThis.docx;

        const warnings = [];

        const body = globalThis.docxHtml.htmlToContent(
            prepareHtml(article),
            {
                baseUrl: article.url,

                onWarning: warning => {
                    warnings.push(warning.message);
                }
            }
        );

        const children = [

            new Paragraph({
                text: article.title,
                heading: HeadingLevel.HEADING_1,
                pageBreakBefore: pageBreak
            }),

            new Paragraph({
                children: [

                    new TextRun("Source: "),

                    new ExternalHyperlink({
                        link: article.url,
                        children: [
                            new TextRun({
                                text: article.url,
                                style: "Hyperlink"
                            })
                        ]
                    })

                ]
            }),

            new Paragraph(
                `Revision ID: ${article.revision ?? "Unavailable"
                }`
            ),

            new Paragraph(
                `Retrieved: ${article.retrievedAt ||
                new Date().toISOString()
                }`
            ),

            new Paragraph(""),

            ...body
        ];

        if (warnings.length) {

            children.push(
                new Paragraph({
                    text: "Conversion notes",
                    heading: HeadingLevel.HEADING_2
                })
            );

            for (const warning of new Set(warnings)) {
                children.push(
                    new Paragraph(warning)
                );
            }
        }

        return children;
    }

    // ========================================
    // Generate complete DOCX document
    // ========================================

    async function createDocument(
        articles,
        summary = [],
        failures = []
    ) {

        ensureReady();

        const {
            Document,
            Paragraph,
            HeadingLevel,
            Packer
        } = globalThis.docx;

        const children = [];

        // Category export summary.

        if (summary.length) {

            children.push(
                new Paragraph({
                    text: summary[0].replace(/^#\s*/, ""),
                    heading: HeadingLevel.TITLE
                })
            );

            for (const line of summary.slice(1)) {

                children.push(
                    new Paragraph(line)
                );

            }
        }

        // Insert every selected article.

        articles.forEach((article, index) => {

            children.push(
                ...articleToContent(
                    article,
                    index > 0 || summary.length > 0
                )
            );

        });

        // Include failed article report.

        if (failures.length) {

            children.push(
                new Paragraph({
                    text: "Failed Articles",
                    heading: HeadingLevel.HEADING_1,
                    pageBreakBefore: true
                })
            );

            for (const failure of failures) {
                children.push(
                    new Paragraph(failure)
                );
            }
        }

        const document = new Document({

            creator: "Wiki Exporter",

            title: articles.length === 1
                ? articles[0].title
                : "Wiki Category Export",

            description:
                "Research document generated by Wiki Exporter.",

            sections: [{
                children
            }]

        });

        return await Packer.toBlob(document);
    }

    return {
        ensureReady,
        createDocument
    };

})();