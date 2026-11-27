// Wiki Exporter — Local output formats, preview and optional export history.
const WikiArchive = (() => {
    const formats = Object.freeze({md:"text/markdown",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",html:"text/html",txt:"text/plain",json:"application/json"});
    const tags = new Set("a abbr b blockquote br caption cite code dd del details div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 hr i ins kbd li mark ol p pre q s samp small span strong sub summary sup table tbody td tfoot th thead tr u ul var".split(" "));
    const discard = new Set("script style iframe frame object embed applet link meta base form input textarea select button svg math canvas audio video img source picture track noscript template".split(" "));
    const blocks = new Set("address article aside blockquote caption dd details div dl dt figcaption figure h1 h2 h3 h4 h5 h6 hr li ol p pre section summary table tbody tfoot thead tr ul".split(" "));
    const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    function httpURL(value, base) {
        try { const u = base ? new URL(value,base) : new URL(value); return ["http:","https:"].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
    }
    // Rebuild the prepared document using a strict element/attribute allowlist.
    // Never copy event handlers, CSS, resource URLs or arbitrary attributes.
    function cleanHTML(html, base, preview=false, local=null) {
        const source = document.createElement("template"); source.innerHTML = String(html ?? "");
        const dest = document.createElement("template");
        function copy(node,parent) {
            if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.data)); return; }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const tag = node.localName.toLowerCase();
            if (discard.has(tag) || node.namespaceURI !== "http://www.w3.org/1999/xhtml") return;
            if (!tags.has(tag)) { for (const child of node.childNodes) copy(child,parent); return; }
            const el = document.createElement(tag);
            if (local && !preview && node.hasAttribute("id")) {
                const id = local.idFor(node.getAttribute("id"));
                if (id) el.id = id;
            }
            if (tag === "a") {
                const raw = node.getAttribute("href");
                const href = raw && httpURL(raw,base);
                if (href && !preview) {
                    const destination = local?.hrefFor(href,node);
                    el.setAttribute("href", destination || href);
                    el.setAttribute("rel","noopener noreferrer");
                }
            }
            if (tag === "td" || tag === "th") for (const name of ["rowspan","colspan"]) {
                const value = node.getAttribute(name);
                if (/^\d{1,3}$/.test(value || "") && Number(value)>0) el.setAttribute(name,value);
            }
            if (tag === "th" && ["row","col","rowgroup","colgroup"].includes(node.getAttribute("scope"))) el.setAttribute("scope",node.getAttribute("scope"));
            if (tag === "ol" && /^-?\d{1,6}$/.test(node.getAttribute("start") || "")) el.setAttribute("start",node.getAttribute("start"));
            if (tag === "details") el.open = true;
            parent.append(el);
            for (const child of node.childNodes) copy(child,el);
        }
        for (const node of source.content.childNodes) copy(node,dest.content);
        return dest.innerHTML;
    }
    function plainText(html, includeLinks=true) {
        const t = document.createElement("template"); t.innerHTML = html;
        function read(node) {
            if (node.nodeType === Node.TEXT_NODE) return node.data.replace(/\s+/g," ");
            if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return "";
            const tag=node.localName;
            if (tag === "br") return "\n";
            if (tag === "pre") return `\n${node.textContent}\n`;
            if (tag === "tr") return "\n" + [...node.children].filter(n=>n.matches("td,th")).map(n=>[...n.childNodes].map(read).join("").trim().replace(/\n+/g," / ")).join(" | ") + "\n";
            let body=[...node.childNodes].map(read).join("");
            if (tag === "a" && includeLinks) { const href=node.getAttribute("href"); if(href && body.trim()!==href) body += ` (${href})`; }
            if (tag === "li") body = "- " + body.trim();
            return blocks.has(tag) ? `\n${body}\n` : body;
        }
        return read(t.content).replace(/[ \t]+\n/g,"\n").replace(/\n[ \t]+/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
    }
    function localPlan(articles, names=null) {
        return WikiLinks.plan(articles,names,el=>{
            if (!tags.has(el.localName) || discard.has(el.localName) || el.namespaceURI !== "http://www.w3.org/1999/xhtml") return false;
            for (let p=el.parentElement;p;p=p.parentElement) {
                if (discard.has(p.localName) || p.namespaceURI !== "http://www.w3.org/1999/xhtml") return false;
            }
            return true;
        });
    }
    function record(article, local=null) {
        const prepared = article.prepared || WikiFidelity.prepare(article);
        const html = cleanHTML(prepared.html,article.url,false,local);
        const text = plainText(html);
        const readable = plainText(html,false);
        return {
            title: article.title, url: article.url, pageId: article.pageId ?? null,
            revision: article.revision ?? null, permanentRevision: WikiFidelity.revisionURL(article),
            retrievedAt: article.retrievedAt || null, license: article.license || null,
            attribution: Object.fromEntries(WikiFidelity.metadata(article)),
            statistics: {approximateWords: readable ? readable.split(/\s+/u).length : 0, ...prepared.stats},
            warnings: WikiFidelity.diagnostics({...article,prepared}),
            content: {html,text}
        };
    }
    function manifest(articles, info={}) {
        const entries=articles.map(article=>{const {content,...metadata}=record(article); return metadata;});
        return {schema:"wiki-exporter.manifest",version:1, generatedAt:new Date().toISOString(), ...info,
            exported: entries.length, approximateWords:entries.reduce((n,a)=>n+a.statistics.approximateWords,0), articles:entries};
    }
    function metaMarkup(item,preview=false) {
        return `<dl>${Object.entries(item.attribution).map(([k,v])=>{const u=httpURL(v);return `<dt>${esc(k)}</dt><dd>${u && !preview?`<a href="${esc(u)}" rel="noopener noreferrer">${esc(v)}</a>`:esc(v)}</dd>`;}).join("")}</dl>`;
    }
    function htmlDocument(records, summary=[], failures=[], preview=false) {
        const title=summary.length?String(summary[0]).replace(/^#\s*/,""):records[0]?.title||"Wiki Export";
        const header=summary.length?`<header><h1>${esc(title)}</h1>${summary.slice(1).map(line=>`<p>${esc(line)}</p>`).join("")}</header>`:"";
        const index=records.length>1 && !preview?`<nav><h2>Article index</h2><ol>${records.map((a,i)=>`<li><a href="#article-${i+1}">${esc(a.title)}</a></li>`).join("")}</ol></nav>`:"";
        const articles=records.map((a,i)=>`<article id="article-${i+1}"><h1>${esc(a.title)}</h1>${metaMarkup(a,preview)}<div class="body">${a.content.html}</div><details open><summary>Conversion diagnostics · approximately ${a.statistics.approximateWords} words</summary><ul>${a.warnings.map(w=>`<li>${esc(w)}</li>`).join("")}</ul></details></article>`).join("");
        const errors=failures.length?`<section><h2>Failed articles</h2><ul>${failures.map(f=>`<li>${esc(f)}</li>`).join("")}</ul></section>`:"";
        return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><style>body{max-width:850px;margin:0 auto;padding:1.5rem;font:16px/1.6 system-ui,sans-serif;color:#202124;background:#fff;overflow-wrap:anywhere}h1,h2,h3{line-height:1.25}article{border-top:1px solid #ccc;padding:1.5rem 0}dl{background:#f3f4f6;padding:1rem;font-size:.85em}dt{font-weight:bold}dd{margin:0 0 .45rem}table{border-collapse:collapse;max-width:100%;font-size:.9em}th,td{border:1px solid #bbb;padding:.5rem;vertical-align:top}th{background:#f1f5f9}pre{white-space:pre-wrap}blockquote{border-left:3px solid #bbb;padding-left:1rem}a{color:#1e40af}details{font-size:.85em;margin-top:1rem}summary{font-weight:bold}@media print{article{break-before:page}a{color:inherit}}</style></head><body>${header}${index}${articles}${errors}</body></html>`;
    }
    async function build(articles,format,summary=[],failures=[],info={},plan=null) {
        if (!Object.hasOwn(formats,format)) throw new Error("Unsupported export format.");
        if (format === "docx") return WikiDocx.createDocument(articles,summary,failures);
        let output;
        if (format === "md") {
            const converter = WikiFidelity.createMarkdownConverter();
            const bodies=articles.map(a=>a.markdown || WikiFidelity.markdown(a,converter));
            output=[...(summary.length?[summary.join("\n\n"),WikiFidelity.articleIndex(articles)]:[]),...bodies,...(failures.length?["# Failed Articles\n\n"+failures.join("\n")]:[])].join("\n\n---\n\n");
        } else {
            const local = format === "html" && info.linkMode === "local"
                ? (plan || localPlan(articles)) : null;
            const records=articles.map(article=>record(article,local?.forArticle(article)||null));
            if (format === "html") output=htmlDocument(records,summary,failures);
            else if (format === "txt") output=[...(summary.length?[summary.join("\n"),"ARTICLE INDEX\n"+records.map((a,i)=>`${i+1}. ${a.title}`).join("\n")]:[]),...records.map(a=>[a.title,...Object.entries(a.attribution).map(([k,v])=>`${k}: ${v}`),"",a.content.text,"","Conversion diagnostics",...a.warnings].join("\n")),...(failures.length?["Failed articles\n"+failures.join("\n")]:[])].join("\n\n"+"=".repeat(60)+"\n\n");
            else output=JSON.stringify({schema:"wiki-exporter.articles",version:1,generatedAt:new Date().toISOString(),...info,summary,failures,articles:records},null,2);
        }
        return new Blob([output],{type:formats[format]+";charset=utf-8"});
    }
    // Preview only the prepared article (not a pixel-accurate rendering of Word).
    // The sandbox and disabled links prevent active content and navigation.
    async function review(articles, summary=[], format="md", mode="combined") {
        if (!articles.length) return false;
        const dialog=document.createElement("dialog"); dialog.className="archive-preview";
        const title=document.createElement("h2");title.textContent="Review prepared content";
        const caption=document.createElement("p");caption.textContent=`${articles.length} article(s) · ${format.toUpperCase()} · ${mode}. Preview shows prepared HTML, not exact final file layout.`;
        const select=document.createElement("select");select.setAttribute("aria-label","Choose article to preview");
        articles.forEach((a,i)=>{const option=document.createElement("option");option.value=String(i);option.textContent=`${i+1}. ${a.title}`;select.append(option);});
        const frame=document.createElement("iframe");frame.title="Prepared article preview";frame.setAttribute("sandbox","");
        const refresh=()=>{const a=record(articles[Number(select.value)]);a.content.html=cleanHTML(a.content.html,a.url,true);frame.srcdoc=htmlDocument([a],[],[],true);};
        select.addEventListener("change",refresh);
        const buttons=document.createElement("div");buttons.className="toolbar";
        const proceed=document.createElement("button");proceed.textContent="Download export";
        const cancel=document.createElement("button");cancel.className="secondary";cancel.textContent="Discard export";
        buttons.append(proceed,cancel); dialog.append(title,caption,select,frame,buttons);document.body.append(dialog);
        return new Promise((resolve,reject)=>{
            const finish=result=>{dialog.remove();resolve(result);};
            proceed.addEventListener("click",()=>dialog.close("download"));cancel.addEventListener("click",()=>dialog.close("discard"));
            dialog.addEventListener("close",()=>finish(dialog.returnValue==="download"),{once:true});
            try {refresh();dialog.showModal();} catch(error){dialog.remove();reject(error);}
        });
    }
    const HISTORY_KEY="wiki-exporter:archive-history";
    const ENABLED_KEY="wiki-exporter:archive-history-enabled";
    function historyEnabled(){try{return localStorage.getItem(ENABLED_KEY)==="true";}catch{return false;}}
    function readHistory(){try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");return Array.isArray(x)?x.filter(e=>e&&typeof e.time==="string"&&Object.hasOwn(formats,e.format)&&["single","combined","separate"].includes(e.mode)&&Number.isInteger(e.count)&&e.count>=0).slice(0,50):[];}catch{return [];}}
    function clearHistory(){try{localStorage.removeItem(HISTORY_KEY);}catch{/* Storage unavailable */}}
    function setHistoryEnabled(enabled){try{localStorage.setItem(ENABLED_KEY,String(Boolean(enabled)));if(!enabled)clearHistory();}catch{/* Storage unavailable */}}
    function log(format,mode,count,partial=false){if(!historyEnabled())return;try{localStorage.setItem(HISTORY_KEY,JSON.stringify([{time:new Date().toISOString(),format,mode,count,partial:Boolean(partial)},...readHistory()].slice(0,50)));}catch{/* Do not interrupt export */}}
    return {formats,cleanHTML,plainText,record,manifest,build,review,localPlan,historyEnabled,readHistory,setHistoryEnabled,clearHistory,log};
})();
