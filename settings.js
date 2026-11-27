
// ========================================
// Wiki Exporter — Local Preferences
// ========================================

const WikiSettings = (() => {

    const PREFIX = "wiki-exporter:settings:";

    const defaults = {
        format: "md",
        output: "combined",
        sort: "asc",
        searchMode: "exact",
        linkMode: "retain"
    };

    const allowed = {
        format: ["md", "docx", "html", "txt", "json"],
        output: ["combined", "separate"],
        sort: ["asc", "desc", "relevance"],
        searchMode: ["exact", "fuzzy"],
        linkMode: ["retain", "wiki", "inline", "local"]
    };

    function get(name) {

        try {

            const value = localStorage.getItem(
                PREFIX + name
            );

            return allowed[name]?.includes(value)
                ? value
                : defaults[name];

        } catch {

            return defaults[name];

        }
    }

    function set(name, value) {

        if (!allowed[name]?.includes(value)) {
            return;
        }

        try {

            localStorage.setItem(
                PREFIX + name,
                value
            );

        } catch (error) {

            console.warn(
                "Unable to save preference:",
                error
            );

        }
    }

    return { get, set };

})();