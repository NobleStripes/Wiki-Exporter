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
    // Advanced Query Parser
    // ========================================

    function canonical(value) {
        return normalize(value)
            .replace(/[_\s]+/gu, " ")
            .trim();
    }

    function parse(query) {

        const source = String(query ?? "").trim();

        const groups = [[]];
        const excluded = [];

        const pattern =
            /(-?)"([^"]*)"|([^\s"]+)/gy;

        let i = 0;
        let expectsTerm = true;
        let negateNext = false;

        while (i < source.length) {

            if (/\s/u.test(source[i])) {
                i++;
                continue;
            }

            pattern.lastIndex = i;

            const token = pattern.exec(source);

            if (!token) {
                throw new Error("Unclosed quotation mark.");
            }

            i = pattern.lastIndex;

            if (
                i < source.length &&
                !/\s/u.test(source[i])
            ) {
                throw new Error(
                    "Separate keywords and phrases with spaces; close all quotes."
                );
            }

            const phrase = token[2] !== undefined;

            const raw = phrase
                ? token[2]
                : token[3];

            const group = groups[groups.length - 1];

            // Boolean operators.

            if (
                !phrase &&
                (raw === "OR" || raw === "AND")
            ) {

                if (
                    expectsTerm ||
                    (raw === "OR" && !group.length)
                ) {
                    throw new Error(
                        `Missing keyword before ${raw}.`
                    );
                }

                if (raw === "OR") {
                    groups.push([]);
                }

                expectsTerm = true;

                continue;
            }

            // NOT operator.

            if (!phrase && raw === "NOT") {

                if (negateNext) {
                    throw new Error(
                        "Repeated NOT operator."
                    );
                }

                negateNext = true;
                expectsTerm = true;

                continue;
            }

            // Exclusion prefix.

            const hasMinus = phrase
                ? token[1] === "-"
                : raw.startsWith("-");

            if (hasMinus && negateNext) {
                throw new Error(
                    "Use NOT or -, not both."
                );
            }

            const value = canonical(
                !phrase && hasMinus
                    ? raw.slice(1)
                    : raw
            );

            if (
                !value ||
                (!phrase && value.startsWith("-"))
            ) {
                throw new Error(
                    "Missing or invalid keyword."
                );
            }

            const term = { value, phrase };

            if (hasMinus || negateNext) {
                excluded.push(term);
            } else {
                group.push(term);
            }

            negateNext = false;
            expectsTerm = false;
        }

        if (source && expectsTerm) {

            throw new Error(
                "Missing keyword after operator."
            );
        }

        if (
            groups.length > 1 &&
            groups.some(group => !group.length)
        ) {

            throw new Error(
                "Each OR branch needs a positive keyword."
            );
        }

        return {
            groups,
            excluded,
            empty: !source
        };
    }

    // ========================================
    // Relevance Scoring
    // ========================================

    function scoreTerm(
        term,
        text,
        domain,
        titleWords,
        mode
    ) {

        const value = term.value;

        // Complete title match.

        if (text === value) return 4;

        // Literal title match.

        if (text.includes(value)) {

            return term.phrase ||
                titleWords.includes(value)
                ? 3
                : 2.5;
        }

        // Community domain match.

        if (domain.includes(value)) {
            return 2;
        }

        // Restrict approximate matching.

        if (
            term.phrase ||
            mode !== "fuzzy" ||
            value.length < 4 ||
            /\p{N}/u.test(value) ||
            !/^[\p{L}]+$/u.test(value)
        ) {
            return null;
        }

        const limit =
            value.length >= 8 ? 2 : 1;

        let best = Infinity;

        for (const word of titleWords) {

            if (
                Math.abs(word.length - value.length)
                > limit
            ) {
                continue;
            }

            best = Math.min(
                best,
                distance(value, word)
            );
        }

        return best <= limit
            ? 2 - best * 0.5
            : null;
    }

    // ========================================
    // Compile Search Query
    // ========================================

    function compile(query, mode = "exact") {

        let parsed;

        try {

            parsed = parse(query);

        } catch (error) {

            return {
                error: error.message,
                empty: false,
                score: () => null
            };
        }

        function score(title, host) {

            const text = canonical(title);
            const domain = canonical(host);
            const titleWords = words(text);

            // Exclusions apply globally.
            // Exclusions never use fuzzy matching.

            if (
                parsed.excluded.some(term =>
                    text.includes(term.value) ||
                    domain.includes(term.value)
                )
            ) {
                return null;
            }

            let best = null;

            // OR groups.

            for (const group of parsed.groups) {

                let total = 0;
                let matched = true;

                // AND keywords within each group.

                for (const term of group) {

                    const result = scoreTerm(
                        term,
                        text,
                        domain,
                        titleWords,
                        mode
                    );

                    if (result === null) {
                        matched = false;
                        break;
                    }

                    total += result;
                }

                if (matched) {

                    best = Math.max(
                        best ?? 0,
                        group.length
                            ? total / group.length
                            : 0
                    );
                }
            }

            return best;
        }

        return {
            error: null,
            empty: parsed.empty,
            score
        };
    }

    // ========================================
    // Backward-compatible matching function
    // ========================================

    function matches(
        title,
        host,
        query,
        mode = "exact"
    ) {

        return compile(query, mode)
            .score(title, host) !== null;
    }

    return {
        compile,
        matches
    };

})();
