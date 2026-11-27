// ========================================
// Restore Export Preferences
// ========================================

const formatSelect =
    document.getElementById("export-format");

formatSelect.value =
    WikiSettings.get("format");

formatSelect.addEventListener("change", () => {

    WikiSettings.set(
        "format",
        formatSelect.value
    );

});

const linkModeSelect = document.getElementById("link-mode");
linkModeSelect.value = WikiSettings.get("linkMode");
linkModeSelect.addEventListener("change",()=>WikiSettings.set("linkMode",linkModeSelect.value));

document.getElementById("export")
  .addEventListener("click", async () => {

    const status = document.getElementById("status");

    try {
      status.textContent = "Extracting article...";

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      if (tab.url && isCategoryPage(tab.url)) {

        const params = new URLSearchParams({
          url: tab.url
        });

        await chrome.tabs.create({
          url: chrome.runtime.getURL(
            "category.html?" + params.toString()
          )
        });

        return;
      }

      if (!tab?.id) {
        throw new Error("No active tab.");
      }

      const [execution] =
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractArticle
        });

      const article = execution.result;

      if (!article || article.error) {
        throw new Error(
          article?.error || "Extraction failed."
        );
      }

      article.retrievedAt = new Date().toISOString();
      article.license = WikiFidelity.rights(
        article.licenseText, article.licenseURL, "Wiki license notice (open page)"
      );
      article.prepared = WikiFidelity.prepare(article);
      if (!article.prepared.hasText) throw new Error("Prepared article is empty.");

      const exportFormat = document.getElementById("export-format").value;
      const requestedLinkMode = WikiLinks.normalize(linkModeSelect.value);
      const linkMode = WikiLinks.effective(requestedLinkMode,exportFormat);
      const preparedArticle = WikiLinks.apply(article,linkMode);
      const filename = article.title.replace(/[<>:"/\\|?*]/g, "_").trim().slice(0, 120) || "Article";
      if (document.getElementById("preview-single").checked) {
        if (!await WikiArchive.review([preparedArticle], [], exportFormat, "single")) {
          status.textContent = "Export discarded. No download requested.";
          return;
        }
      }
      const blob = await WikiArchive.build([preparedArticle], exportFormat, [], [], {requestedLinkMode,linkMode});
      downloadFile(blob, `${filename}.${exportFormat}`);
      WikiArchive.log(exportFormat, "single", 1);

      status.textContent = "Export download requested.";

    } catch (error) {
      status.textContent = error.message;
    }
  });

function extractArticle() {
  if (location.protocol !== "https:" || !location.hostname.endsWith(".fandom.com")) {
    return { error: "This version supports Fandom only." };
  }
  const article = document.querySelector(".mw-parser-output");
  if (!article) return { error: "Article content not found." };

  // Read explicit revision metadata, never evaluate inline page scripts.
  const revisionCandidates = new Set();
  const addRevision = value => {
    if (/^[1-9]\d*$/.test(String(value || ""))) revisionCandidates.add(String(value));
  };
  addRevision(document.querySelector('meta[property="mw:revisionId"]')?.content);
  addRevision(new URL(location.href).searchParams.get("oldid"));
  for (const link of document.querySelectorAll('#t-permalink a[href]')) {
    try {
      const u = new URL(link.href);
      if (u.origin !== location.origin) continue;
      addRevision(u.searchParams.get("oldid"));
      const match = u.pathname.match(/\/Special:(?:PermanentLink|PermaLink)\/(\d+)$/i);
      if (match) addRevision(match[1]);
    } catch { /* Ignore malformed links. */ }
  }
  for (const script of document.head.querySelectorAll('script:not([src])')) {
    for (const match of script.textContent.matchAll(/"wgRevisionId"\s*:\s*([1-9]\d*)\b/g)) addRevision(match[1]);
  }
  const revision = revisionCandidates.size === 1 ? [...revisionCandidates][0] : null;

  // Only inspect explicit license notices, not arbitrary links inside articles.
  const licenses = new Map();
  for (const link of document.querySelectorAll('head link[rel~="license"], #footer-info-copyright a[href], .page-footer__copyright a[href], .license-description a[href]')) {
    try {
      const u = new URL(link.getAttribute("href"), location.href);
      if (!["https:", "http:"].includes(u.protocol)) continue;
      const explicit = link.rel?.split(/\s+/).includes("license");
      const isCC = /(^|\.)creativecommons\.org$/i.test(u.hostname) && /^\/(licenses|publicdomain)\//.test(u.pathname);
      const generic = /(^|\.)fandom\.com$/i.test(u.hostname) && /^\/licensing\/?$/i.test(u.pathname);
      if (!generic && (explicit || isCC)) {
        u.hash = "";
        if (isCC) {
          u.protocol = "https:";
          u.search = "";
          const path = u.pathname.match(/^\/(?:licenses\/[a-z-]+\/[0-9.]+(?:\/[a-z]{2})?|publicdomain\/[a-z-]+\/[0-9.]+)\//i);
          if (path) u.pathname = path[0];
        }
        licenses.set(u.href, link.textContent.trim() || u.href);
      }
    } catch { /* Unknown source license remains unverified. */ }
  }
  const license = licenses.size === 1 ? [...licenses.entries()][0] : null;
  return {
    title: document.querySelector(".page-header__title")?.textContent.trim() || document.title,
    url: location.href,
    revision,
    licenseText: license?.[1] || null,
    licenseURL: license?.[0] || null,
    // Return the untouched article body; shared preparation handles cleanup.
    html: article.innerHTML
  };
}

function downloadFile(
  content,
  filename,
  type = "text/markdown"
) {

  const blob = content instanceof Blob
    ? content
    : new Blob([content], {
      type: `${type};charset=utf-8`
    });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30000);
}

// ========================================
// Research Collection
// ========================================

document.getElementById("open-collection")
    .addEventListener("click", async () => {

        await chrome.tabs.create({
            url: chrome.runtime.getURL(
                "category.html"
            )
        });

    });