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

    // RC: limit category discovery independently of the article export cap.
    const MAX_DISCOVERY_PAGES = 50;
    const MAX_DISCOVERY_MEMBERS = 10000;
    const seenContinuations = new Set();
    const members = new Map();
    let continuation = {};
    let pages = 0;

    do {
        if (++pages > MAX_DISCOVERY_PAGES) {
            throw new Error("Category discovery exceeded 50 API pages. Choose a narrower category.");
        }
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

        const data = await WikiRequest.getJSON(
            url.origin,
            params,
            signal
        );

        const entries = data.query?.categorymembers;
        if (!Array.isArray(entries)) throw new Error("Unexpected category response.");
        for (const member of entries) {
            if (!member || !Number.isSafeInteger(member.pageid) || member.pageid < 1 ||
                typeof member.title !== "string" || !member.title.trim() || !Number.isInteger(member.ns)) {
                throw new Error("Invalid category member in server response.");
            }
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

        if (members.size > MAX_DISCOVERY_MEMBERS) {
            throw new Error("Category discovery exceeded 10,000 members. Choose a narrower category.");
        }
        const next = data.continue;
        if (next == null) {
            continuation = null;
        } else {
            if (typeof next !== "object" || Array.isArray(next) ||
                Object.keys(next).some(key => !["continue", "cmcontinue"].includes(key)) ||
                typeof next.cmcontinue !== "string" || !next.cmcontinue ||
                (Object.hasOwn(next, "continue") && typeof next.continue !== "string")) {
                throw new Error("Invalid category continuation returned by server.");
            }
            // Explicitly copy only permitted server pagination keys.
            continuation = { cmcontinue: next.cmcontinue };
            if (Object.hasOwn(next, "continue")) continuation.continue = next.continue;
            const key = JSON.stringify([continuation.cmcontinue, continuation.continue ?? null]);
            if (seenContinuations.has(key)) throw new Error("Repeated category continuation; discovery stopped.");
            seenContinuations.add(key);
            if (members.size >= MAX_DISCOVERY_MEMBERS) {
                throw new Error("Category discovery reached 10,000 members with more available. Choose a narrower category.");
            }
        }

    } while (continuation);

    return [...members.values()];
}