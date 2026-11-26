const params = new URLSearchParams(location.search);
const categoryUrl = params.get("url");

const status = document.getElementById("status");
const articleList = document.getElementById("article-list");

document.getElementById("load-category")
    .addEventListener("click", async () => {

        try {

            document.getElementById("load-category")
                .disabled = true;

            articleList.replaceChildren();

            const url = new URL(categoryUrl);

            if (
                url.protocol !== "https:" ||
                !url.hostname.endsWith(".fandom.com") ||
                !isCategoryPage(url.href)
            ) {
                throw new Error("Invalid Fandom category URL.");
            }

            const granted = await chrome.permissions.request({
                origins: [`${url.origin}/*`]
            });

            if (!granted) {
                throw new Error("Permission not granted.");
            }

            status.textContent = "Loading category...";

            const members = await getCategoryMembers(
                categoryUrl
            );

            const articles = members.filter(
                member => member.namespace === 0
            );

            articleList.replaceChildren();

            for (const article of articles) {

                const label = document.createElement("label");
                const checkbox = document.createElement("input");

                checkbox.type = "checkbox";
                checkbox.value = article.url;
                checkbox.checked = true;

                label.appendChild(checkbox);
                label.appendChild(
                    document.createTextNode(article.title)
                );

                articleList.appendChild(label);
                articleList.appendChild(
                    document.createElement("br")
                );
            }

            status.textContent =
                `${articles.length} articles found.`;

        } catch (error) {
            status.textContent = error.message;
            
        } finally {

            document.getElementById("load-category")
                .disabled = false;
        }

    });