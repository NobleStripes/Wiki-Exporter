
// ========================================
// Wiki Exporter — Local Preferences
// ========================================

const WikiSettings = (() => {

    const PREFIX = "wiki-exporter:settings:";

    const defaults = {
        format: "md",
        output: "combined",
        sort: "asc",
        searchMode: "exact"
    };

    const allowed = {
        format: ["md", "docx"],
        output: ["combined", "separate"],
        sort: ["asc", "desc", "relevance"],
        searchMode: ["exact", "fuzzy"]
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