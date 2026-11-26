function isCategoryPage(url) {
    const path = decodeURIComponent(
        new URL(url).pathname
    );

    return path.startsWith("/wiki/Category:");
}

function extractCategoryMembers() {
    const links = document.querySelectorAll(
        "a.category-page__member-link"
    );

    const members = [...links].map(link => ({
        title: link.textContent.trim(),
        url: link.href,
        isCategory: decodeURIComponent(
            new URL(link.href).pathname
        ).startsWith("/wiki/Category:")
    }));

    return [...new Map(
        members.map(member => [member.url, member])
    ).values()];
}

async function getCategoryMembers(categoryUrl, signal) {
    const url = new URL(categoryUrl);

    if (!url.hostname.endsWith(".fandom.com") ||
        url.protocol !== "https:") {
        throw new Error("Unsupported wiki");
    }

    const category = decodeURIComponent(
        url.pathname.replace(/^\/wiki\//, "")
    );

    if (!category.startsWith("Category:")) {
        throw new Error("Invalid category URL");
    }

    const members = new Map();
    let continuation = {};

    do {
        const params = new URLSearchParams({
            action: "query",
            list: "categorymembers",
            cmtitle: category,
            cmtype: "page|subcat",
            cmprop: "ids|title|type",
            cmlimit: "max",
            format: "json",
            ...continuation
        });

        const response = await fetch(
            `${url.origin}/api.php?${params}`,
            { signal, credentials: "omit" }
        );

        if (!response.ok) {
            throw new Error(
                `HTTP error: ${response.status}`
            );
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.info);
        }

        for (const member of data.query.categorymembers) {
            members.set(member.pageid, {
                id: member.pageid,
                title: member.title,
                namespace: member.ns,
                type: member.type,
                url: `${url.origin}/wiki/${
                    encodeURIComponent(
                        member.title.replaceAll(" ", "_")
                    )
                }`
            });
        }

        continuation = data.continue || null;

    } while (continuation);

    return [...members.values()];
}