
// ========================================
// Wiki Exporter — Request Safeguards
// ========================================

const WikiRequest = (() => {

    const REQUEST_INTERVAL = 2000;
    const REQUEST_TIMEOUT = 30000;
    const DEFAULT_COOLDOWN = 300000;
    const MAX_BATCH = 100;

    const LAST_REQUEST_KEY =
        "wiki-exporter:last-request";

    // ========================================
    // Stop-batch error
    // ========================================

    function stopError(message) {

        const error = new Error(message);
        error.stopBatch = true;

        return error;
    }

    // ========================================
    // Abortable delay
    // ========================================

    function sleep(ms, signal) {

        return new Promise((resolve, reject) => {

            if (signal?.aborted) {
                reject(signal.reason);
                return;
            }

            const timer = setTimeout(() => {

                signal?.removeEventListener(
                    "abort", abort
                );

                resolve();

            }, ms);

            function abort() {

                clearTimeout(timer);
                reject(signal.reason);
            }

            signal?.addEventListener(
                "abort",
                abort,
                { once: true }
            );
        });
    }

    // ========================================
    // Validate permitted wiki origin
    // ========================================

    function validateOrigin(origin) {

        const url = new URL(origin);

        if (
            url.protocol !== "https:" ||
            !url.hostname.endsWith(".fandom.com") ||
            url.origin !== origin ||
            url.port
        ) {
            throw stopError(
                "Unsupported or invalid wiki origin."
            );
        }
    }

    // ========================================
    // Server cooldown management
    // ========================================

    function cooldownKey(origin) {

        return `wiki-exporter:cooldown:${origin}`;
    }

    function setCooldown(origin, retryAfter) {

        let duration = DEFAULT_COOLDOWN;

        if (retryAfter) {

            if (/^\d+$/.test(retryAfter)) {

                duration = Number(retryAfter) * 1000;

            } else {

                const date = Date.parse(retryAfter);

                if (Number.isFinite(date)) {
                    duration = date - Date.now();
                }
            }
        }

        if (!Number.isFinite(duration)) {
            duration = DEFAULT_COOLDOWN;
        }

        // Minimum cooldown: one minute.

        duration = Math.max(60000, duration);

        const until = Date.now() + duration;

        localStorage.setItem(
            cooldownKey(origin),
            String(until)
        );

        return new Date(until).toLocaleString();
    }

    function checkCooldown(origin) {

        const until = Number(
            localStorage.getItem(
                cooldownKey(origin)
            ) || 0
        );

        if (Date.now() < until) {

            throw stopError(
                "Wiki temporarily unavailable. " +
                "Cooldown active until " +
                new Date(until).toLocaleString()
            );
        }

        localStorage.removeItem(
            cooldownKey(origin)
        );
    }

    // ========================================
    // Protected API request
    // ========================================

    async function getJSON(origin, params, signal) {

        validateOrigin(origin);

        const query = new URLSearchParams(params);

        // Only allow the existing read operations.

        const action = query.get("action");

        if (
            action !== "parse" &&
            !(
                action === "query" &&
                query.get("list") === "categorymembers"
            )
        ) {
            throw stopError(
                "Unsupported API operation."
            );
        }

        query.set("maxlag", "5");
        query.set("format", "json");

        // Fail safely if cross-tab locking
        // is unavailable.

        if (!navigator.locks) {

            throw stopError(
                "Request locking is unavailable."
            );
        }

        return navigator.locks.request(
            "wiki-exporter-api-request",
            signal ? { signal } : {},

            async () => {

                signal?.throwIfAborted();

                checkCooldown(origin);

                // Enforce the interval across tabs.

                const lastRequest = Number(
                    localStorage.getItem(
                        LAST_REQUEST_KEY
                    ) || 0
                );

                const elapsed =
                    Date.now() - lastRequest;

                if (elapsed < REQUEST_INTERVAL) {

                    await sleep(
                        REQUEST_INTERVAL - elapsed,
                        signal
                    );
                }

                signal?.throwIfAborted();

                const timeoutSignal =
                    AbortSignal.timeout(
                        REQUEST_TIMEOUT
                    );

                const requestSignal = signal

                    ? AbortSignal.any([
                        signal,
                        timeoutSignal
                    ])

                    : timeoutSignal;

                localStorage.setItem(
                    LAST_REQUEST_KEY,
                    String(Date.now())
                );

                try {

                    let response;

                    try {

                        response = await fetch(
                            `${origin}/api.php?${query}`,
                            {
                                method: "GET",
                                credentials: "omit",
                                redirect: "error",
                                signal: requestSignal
                            }
                        );

                    } catch (error) {

                        if (signal?.aborted) {
                            throw error;
                        }

                        if (timeoutSignal.aborted) {

                            throw stopError(
                                "Request timed out. " +
                                "Export stopped."
                            );
                        }

                        throw stopError(
                            "Network request failed. " +
                            "Export stopped."
                        );
                    }

                    // Access denied: do not retry.

                    if (
                        response.status === 401 ||
                        response.status === 403
                    ) {

                        throw stopError(
                            `Access denied (${response.status}). ` +
                            "Export stopped."
                        );
                    }

                    // Rate limiting or server overload.

                    if (
                        response.status === 429 ||
                        response.status >= 500
                    ) {

                        const until = setCooldown(
                            origin,
                            response.headers.get(
                                "Retry-After"
                            )
                        );

                        throw stopError(
                            `HTTP ${response.status}. ` +
                            `Cooldown until ${until}.`
                        );
                    }

                    if (!response.ok) {

                        throw stopError(
                            `HTTP ${response.status}. ` +
                            "Export stopped."
                        );
                    }

                    // Reject unexpected non-JSON responses.

                    let data;

                    try {

                        data = await response.json();

                    } catch {

                        if (signal?.aborted) {
                            throw signal.reason;
                        }

                        throw stopError(
                            "Unexpected server response. " +
                            "Expected JSON. Export stopped."
                        );
                    }

                    // MediaWiki-specific errors.

                    if (data.error) {

                        const code = data.error.code;

                        if ([
                            "ratelimited",
                            "maxlag",
                            "readonly"
                        ].includes(code)) {

                            const until = setCooldown(
                                origin,
                                response.headers.get(
                                    "Retry-After"
                                )
                            );

                            throw stopError(
                                `MediaWiki: ${code}. ` +
                                `Cooldown until ${until}.`
                            );
                        }

                        // Missing articles may be skipped.

                        if ([
                            "missingtitle",
                            "invalidtitle",
                            "nosuchpageid",
                            "nosuchrevid"
                        ].includes(code)) {

                            throw new Error(
                                data.error.info || code
                            );
                        }

                        // Other API errors stop the batch.

                        throw stopError(
                            data.error.info || code
                        );
                    }

                    return data;

                } finally {

                    localStorage.setItem(
                        LAST_REQUEST_KEY,
                        String(Date.now())
                    );
                }
            }
        );
    }

    return {
        getJSON,
        MAX_BATCH
    };

})();
