// ========================================
// Wiki Exporter — Keyword and Fuzzy Search
// ========================================

const WikiSearch = (() => {

    function normalize(value) {

        return String(value ?? "")
            .normalize("NFKD")
            .replace(/\p{M}/gu, "")
            .toLocaleLowerCase()
            .trim();

    }

    function words(value) {

        return normalize(value)
            .match(/[\p{L}\p{N}]+/gu) || [];

    }

    // ========================================
    // Optimal String Alignment distance
    // ========================================

    function distance(a, b) {

        const dp = Array.from(
            { length: a.length + 1 },
            () => Array(b.length + 1).fill(0)
        );

        for (let i = 0; i <= a.length; i++) {
            dp[i][0] = i;
        }

        for (let j = 0; j <= b.length; j++) {
            dp[0][j] = j;
        }

        for (let i = 1; i <= a.length; i++) {

            for (let j = 1; j <= b.length; j++) {

                const cost =
                    a[i - 1] === b[j - 1] ? 0 : 1;

                dp[i][j] = Math.min(

                    dp[i - 1][j] + 1,

                    dp[i][j - 1] + 1,

                    dp[i - 1][j - 1] + cost

                );

                // Handle transposed characters.

                if (
                    i > 1 &&
                    j > 1 &&
                    a[i - 1] === b[j - 2] &&
                    a[i - 2] === b[j - 1]
                ) {

                    dp[i][j] = Math.min(
                        dp[i][j],
                        dp[i - 2][j - 2] + 1
                    );

                }
            }
        }

        return dp[a.length][b.length];

    }

    // ========================================
    // Keyword matching
    // ========================================

    function matches(
        title,
        host,
        query,
        mode = "exact"
    ) {

        const normalizedQuery = normalize(query);

        if (!normalizedQuery) return true;

        const terms = words(normalizedQuery);

        if (!terms.length) return false;

        const text = normalize(title);
        const domain = normalize(host);
        const titleWords = words(text);

        return terms.every(term => {

            // Prioritize literal matches.

            if (
                text.includes(term) ||
                domain.includes(term)
            ) {
                return true;
            }

            // Short keywords and numbers
            // must match literally.

            if (
                mode !== "fuzzy" ||
                term.length < 4 ||
                /\p{N}/u.test(term)
            ) {
                return false;
            }

            const limit =
                term.length >= 8 ? 2 : 1;

            return titleWords.some(word => {

                if (
                    Math.abs(
                        word.length - term.length
                    ) > limit
                ) {
                    return false;
                }

                return distance(term, word) <= limit;

            });

        });
    }

    return { matches };

})();
