
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

      const converter = new TurndownService({
        headingStyle: "atx",
        bulletListMarker: "-",
        codeBlockStyle: "fenced"
      });

      converter.use(turndownPluginGfm.gfm);

      const markdown = [
        `# ${article.title}`,
        `Source: ${article.url}`,
        `Retrieved: ${new Date().toISOString()}`,
        "",
        converter.turndown(article.html)
      ].join("\n\n");

      const filename = article.title
        .replace(/[<>:"/\\|?*]/g, "_")
        .trim();

      downloadFile(
        markdown,
        `${filename}.md`,
        "text/markdown"
      );

      status.textContent = "Export generated.";

    } catch (error) {
      status.textContent = error.message;
    }
  });

function extractArticle() {

  if (
    !location.hostname.endsWith(".fandom.com")
  ) {
    return {
      error: "This version supports Fandom only."
    };
  }

  const article = document.querySelector(
    ".mw-parser-output"
  );

  if (!article) {
    return {
      error: "Article content not found."
    };
  }

  const content = article.cloneNode(true);

  content.querySelectorAll(`
    script,
    style,
    iframe,
    .mw-editsection,
    .wikia-ad,
    .toc
  `).forEach(element => element.remove());

  content.querySelectorAll("a[href]")
    .forEach(link => {
      try {
        const url = new URL(
          link.getAttribute("href"),
          document.baseURI
        );

        if (["http:", "https:"].includes(url.protocol)) {
          link.setAttribute("href", url.href);
        } else {
          link.removeAttribute("href");
        }
      } catch {
        link.removeAttribute("href");
      }
    });

  return {
    title:
      document.querySelector(".page-header__title")
        ?.textContent.trim() || document.title,

    url: location.href,

    html: content.innerHTML
  };
}

function downloadFile(content, filename, type) {

  const blob = new Blob([content], {
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
