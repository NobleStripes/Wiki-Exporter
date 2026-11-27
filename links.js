// Wiki Exporter — Local link policies and offline navigation (v0.9.1).
const WikiLinks = (() => {
    const modes = Object.freeze(["retain", "wiki", "inline", "local"]);
    const labels = Object.freeze({retain:"Retain All Links",wiki:"Strip Wiki Links",inline:"Strip Inline Links",local:"Local Navigation (HTML)"});
    function normalize(mode) { return modes.includes(mode) ? mode : "retain"; }
    function effective(mode, format) { const m=normalize(mode);return m==="local"&&format!=="html"?"retain":m; }
    function url(value, base) {
        if (typeof value!=="string" || !value.trim()) return null;
        try { const u=new URL(value,base);return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password?u:null; } catch {return null;}
    }
    function decoded(value) { try{return decodeURIComponent(value);}catch{return value;} }
    function titlePath(u) {
        if(!u || !u.hostname.endsWith(".fandom.com") || !u.pathname.startsWith("/wiki/") || u.port)return null;
        const title=decoded(u.pathname.slice(6)).replace(/[_\s]+/gu," ").trim();
        return title || null;
    }
    const nonArticle=/^(special|category|file|image|media|template(?: talk)?|module(?: talk)?|user(?: talk)?|talk|help(?: talk)?|mediawiki(?: talk)?|forum|message wall|thread|blog|fandom(?: talk)?|category talk|file talk):/i;
    function articleKey(u) {
        const title=titlePath(u);
        if(!title || nonArticle.test(title) || [...u.searchParams.keys()].some(k=>k!=="so"&&!k.startsWith("utm_")))return null;
        // Preserve title case; only normalize encoding, underscores and spaces.
        return `${u.origin}/wiki/${encodeURIComponent(title.replaceAll(" ","_"))}`;
    }
    function revisionKey(u) {
        if(!u || !u.hostname.endsWith(".fandom.com") || u.port)return null;
        const match=decoded(u.pathname).match(/^\/wiki\/Special:(?:PermanentLink|PermaLink)\/([1-9]\d*)$/i);
        if(match && !u.search)return `${u.origin}:revision:${match[1]}`;
        if(u.pathname.startsWith("/wiki/") && [...u.searchParams.keys()].every(k=>k==="oldid") && /^[1-9]\d*$/.test(u.searchParams.get("oldid")||""))return `${u.origin}:revision:${u.searchParams.get("oldid")}`;
        return null;
    }
    function protectedLink(a,u,article) {
        if(a.closest('.references,.reference,.mw-references-wrap,.reflist,.citation,.cite,.mw-cite-backlink,[role="doc-biblioref"],[role="doc-noteref"],[role="doc-backlink"],[role="doc-endnotes"],[role="doc-footnote"],cite,.license-description,.license,[rel~="license"]'))return true;
        if(a.matches('.reference-text,.external.autonumber,[rel~="license"]'))return true;
        if(/^#?(cite_(note|ref)[-_]|ref[-_]|fn[-_])/i.test(decoded(u.hash.slice(1))))return true;
        if(/^\[Image:/i.test(a.textContent.trim()))return true;
        if(/(^|\.)creativecommons\.org$/i.test(u.hostname) && /^\/(licenses|publicdomain)\//i.test(u.pathname))return true;
        // Keep recognizable revision/history/author/license links in the body as well.
        if(revisionKey(u) || u.searchParams.get("action")==="history" || /^Special:(?:Contributions|PermanentLink|PermaLink)/i.test(titlePath(u)||"") || (u.hostname.endsWith(".fandom.com")&&/^\/licensing\/?$/i.test(u.pathname)))return true;
        const source=url(article.url), targetKey=articleKey(u);
        if(u.hash && source && targetKey && targetKey===articleKey(source))return true;
        if(u.hash && source && u.origin===source.origin && u.pathname===source.pathname)return true;
        return false;
    }
    function apply(article, mode="retain") {
        mode=normalize(mode);
        const prepared=article.prepared||WikiFidelity.prepare(article);
        if(mode==="retain"||mode==="local")return {...article,prepared,linkMode:mode};
        const t=document.createElement("template");t.innerHTML=prepared.html;
        let removed=0;
        for(const a of t.content.querySelectorAll("a[href]")) {
            const u=url(a.getAttribute("href"),article.url);
            if(!u || protectedLink(a,u,article))continue;
            if(mode==="wiki"&&!articleKey(u))continue;
            // Remove the hyperlink, not the displayed text, formatting or anchor ID.
            const text = document.createElement("span");
            for (const name of ["id","class","title","lang","dir"]) {
                if (a.hasAttribute(name)) text.setAttribute(name,a.getAttribute(name));
            }
            text.append(...a.childNodes);
            a.replaceWith(text);removed++;
        }
        const warnings=[...(prepared.warnings||[]),`Body link policy: ${labels[mode]}; ${removed} ordinary hyperlink(s) removed. Recognizable citations and source metadata retained.`];
        return {...article,linkMode:mode,markdown:null,prepared:{...prepared,html:t.innerHTML,stats:{...prepared.stats,ordinaryLinksRemoved:removed},warnings}};
    }
    function filename(article,index,format) {
        const title=String(article.title||"").replace(/[<>:"/\\|?*\x00-\x1f]/g,"_").replace(/\s+/g,"_").trim().slice(0,120)||"Article";
        return `${String(index+1).padStart(3,"0")}_${title}.${format}`;
    }
    // Map only articles and section IDs that will actually be emitted. Raw IDs never
    // enter the output: we generate ASCII-only, scoped identifiers instead.
    // `names` maps canonical article URLs to archive basenames for separate exports.
    function plan(articles, names, canKeep) {
        const lookup=new Map(), context=new Map();
        const register=(key,entry)=>{if(!key)return;if(lookup.has(key)&&lookup.get(key)!==entry)lookup.set(key,null);else lookup.set(key,entry);};
        articles.forEach((article,index)=>{
            const prefix=names?"article-1":`article-${index+1}`;
            const file=names?names.get(article.url):null;
            // No arbitrary relative URLs: only exporter-generated basenames are used.
            if(names&&(!file||!/^\d+_[^/\\\x00-\x1f]+\.html$/.test(file)))throw Error("Missing or invalid local article filename.");
            const root=document.createElement("template");root.innerHTML=(article.prepared||WikiFidelity.prepare(article)).html;
            const idMap=new Map();let n=0;
            for(const el of root.content.querySelectorAll("[id]")) {
                if(!canKeep(el))continue;
                const id=el.id;if(!id)continue;
                if(idMap.has(id))idMap.set(id,null);else idMap.set(id,`${prefix}-section-${++n}`);
            }
            const entry={prefix,file,idMap,article};context.set(article,entry);
            const u=url(article.url);register(articleKey(u),entry);register(revisionKey(url(WikiFidelity.revisionURL(article))),entry);
            for(const raw of (article.aliases||[]))register(articleKey(url(raw)),entry);
        });
        function resolve(current,href,node) {
            const u=url(href,current.article.url);if(!u)return null;
            const key=revisionKey(u)||articleKey(u);
            const target=key&&lookup.get(key);if(!target)return null;
            // Citation destinations and explicit provenance links remain online,
            // except known navigation anchors within the very same article.
            if(node && protectedLink(node,u,current.article) && (target!==current || !u.hash))return null;
            const fragment=decoded(u.hash.slice(1));
            const id=fragment?target.idMap.get(fragment):target.prefix;
            if(!id)return null; // Never replace an unknown section with a misleading jump.
            if(!names||target===current)return `#${id}`;
            return `${encodeURIComponent(target.file)}#${id}`;
        }
        return {forArticle(article){const entry=context.get(article);if(!entry)return null;return {idFor:id=>entry.idMap.get(id)||null,hrefFor:(href,node)=>resolve(entry,href,node)};}};
    }
    return {modes,labels,normalize,effective,apply,plan,filename};
})();
