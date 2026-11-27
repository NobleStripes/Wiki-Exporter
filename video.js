// Wiki Exporter — independent, offline video link policy.
const WikiVideo = (() => {
    const modes = Object.freeze(['captions', 'retain']);
    const labels = Object.freeze({captions:'Video titles and captions only', retain:'Retain video links'});
    const normalize = mode => modes.includes(mode) ? mode : 'captions';
    const marker = 'data-wiki-exporter-video';
    const protectedSelector = '.references,.reference,.mw-references-wrap,.reflist,.citation,.cite,.mw-cite-backlink,cite,[role="doc-biblioref"],[role="doc-noteref"],[role="doc-backlink"],[role="doc-endnotes"],[role="doc-footnote"],.license-description,.license,[rel~="license"]';
    const players = '.video-embed,.video-embed-container,.video-player,.wikia-video,.fandom-video,.jwplayer,.video-thumbnail,.video-thumb,.wikia-video-player,.fandom-video-player,.featured-video-player,.wikia-video-embed,.video-embed-thumbnail';
    const captionSelector = 'figcaption,.video-caption,.video-description,.video-title,.video-embed-caption,.gallerytext,.gallery-caption,.thumbcaption';
    function safeURL(raw,base) {
        if(typeof raw !== 'string' || !raw.trim()) return null;
        try {const u=new URL(raw,base);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u:null;} catch {return null;}
    }
    function decode(s){try{return decodeURIComponent(s);}catch{return s;}}
    function videoURL(u) {
        if(!u)return false;
        const path=decode(u.pathname), host=u.hostname.toLowerCase();
        if(u.searchParams.has('oldid') || u.searchParams.get('action')==='history')return false;
        if(/\.(?:mp4|webm|ogv|m4v|mov|avi|mkv|flv|wmv|mpeg|mpg|m3u8|mpd)(?:\/|$)/i.test(path))return true;
        if(host.endsWith('.fandom.com')&&path.startsWith('/wiki/')){
            const title=path.slice(6).replaceAll('_',' ');
            if(/^Video:/i.test(title)||/\/(?:videos?|video gallery)(?:\/|$)/i.test(title))return true;
        }
        if(host==='youtu.be')return /^\/[^/]+/.test(path);
        if(/(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(host))return (path==='/watch'&&u.searchParams.has('v'))||/^\/(?:embed|shorts|live|v)\/[^/]+/.test(path);
        if(/(^|\.)vimeo\.com$/.test(host))return /^\/(?:video\/)?\d+(?:\/|$)/.test(path)||/\/videos\/\d+(?:\/|$)/.test(path);
        if(/(^|\.)dailymotion\.com$/.test(host))return /^\/(?:embed\/)?video\/[^/]+/.test(path);
        if(host==='dai.ly')return /^\/[^/]+/.test(path);
        if(/(^|\.)(jwplayer\.com|jwplatform\.com)$/.test(host))return /^\/(?:players|videos|manifests|previews)\//.test(path);
        return host==='video.fandom.com' && path!=='/';
    }
    function isProtected(a,u) {
        return Boolean(a.closest(protectedSelector)||a.matches('.reference-text,.external.autonumber')||(u&&(u.searchParams.has('oldid')||u.searchParams.get('action')==='history'||/^(?:cite_(?:note|ref)[-_]|ref[-_]|fn[-_])/i.test(decode(u.hash.slice(1)))||(/(^|\.)creativecommons\.org$/i.test(u.hostname)&&/^\/(licenses|publicdomain)\//i.test(u.pathname)))));
    }
    function text(s) {return String(s??'').replace(/\s+/g,' ').trim();}
    function useful(s) {const v=text(s);return v&&!/^https?:\/\/\S+$/i.test(v)&&!/^(?:video|video player|embedded video|youtube video player|play video|play|pause|watch video|thumbnail)$/i.test(v)?v:'';}
    function candidates(el,base) {
        for(const n of [el,...el.querySelectorAll('video,source,iframe,object,embed,a[href],[data-video-url],[data-src]')]){
            for(const attr of ['data-video-url','data-src','src','data','href']){
                const u=safeURL(n.getAttribute(attr),base);
                if(videoURL(u))return u;
                // Direct HTML5 source URLs sometimes do not have a filename extension.
                if(u&&['video','source'].includes(n.localName)&&['src','data-src'].includes(attr))return u;
            }
        }
        return null;
    }
    function copyId(from,to){if(from.id)to.id=from.id;}
    function unwrap(a){const span=document.createElement('span');for(const k of ['id','class','title','lang','dir'])if(a.hasAttribute(k))span.setAttribute(k,a.getAttribute(k));span.append(...a.childNodes);a.replaceWith(span);}
    function apply(root,article,stats) {
        const mode=normalize(article.videoMode),keep=mode==='retain';
        let embeds=0,stripped=0,retained=0,thumbs=0,noURL=0;
        // Discard untrusted source markers. Only this module can assign its own marker.
        for(const a of root.querySelectorAll(`[${marker}]`))a.removeAttribute(marker);
        // Work in document order, processing outer recognized player containers first.
        // Ordinary figures and prose wrappers are not treated as players.
        const elements=[...root.querySelectorAll(`video,iframe,object,embed,${players}`)];
        for(const el of elements) {
            if(!root.contains(el))continue;
            const explicit=el.matches(players)||el.localName==='video';
            let dest=candidates(el,article.url);
            if(!explicit&&!dest)continue; // Unrelated iframes handled by existing cleanup.
            const parentLink=el.localName==='a'?el.parentElement?.closest('a'):el.closest('a');
            const parentURL=parentLink&&safeURL(parentLink.getAttribute('href'),article.url);
            if(!dest&&videoURL(parentURL))dest=parentURL;
            const protectedEmbed=Boolean(el.closest(protectedSelector)|| (parentLink&&isProtected(parentLink,parentURL)));
            const shouldLink=(keep||protectedEmbed)&&dest;
            const replacement=document.createElement('span');copyId(el,replacement);
            const captions=[...el.querySelectorAll(captionSelector)].filter(n=>{const ancestor=n.parentElement?.closest(captionSelector);return !ancestor||!el.contains(ancestor);});
            const descriptions=[];
            const add=s=>{s=useful(s);if(s&&!descriptions.some(x=>x.toLowerCase()===s.toLowerCase()))descriptions.push(s);};
            add(el.getAttribute('data-video-title'));add(el.getAttribute('title'));add(el.getAttribute('aria-label'));
            const richCaptions=captions.filter(c=>c.querySelector('a[href],sup.reference,[id]')||c.id);
            for(const c of captions)if(!richCaptions.includes(c))add(c.textContent);
            if(!descriptions.length&&!richCaptions.length)for(const img of el.querySelectorAll('img'))add(img.getAttribute('alt')||img.getAttribute('title'));
            // Preserve literal video fallback text (not player UI or inline scripts).
            if(el.localName==='video')for(const n of el.childNodes)if(n.nodeType===Node.TEXT_NODE)add(n.textContent);
            const figure=el.closest('figure');const outsideCaption=figure?.querySelector('figcaption');
            if(outsideCaption&&!el.contains(outsideCaption)){
                const existing=text(outsideCaption.textContent).toLowerCase();
                for(let i=descriptions.length-1;i>=0;i--)if(descriptions[i].toLowerCase()===existing)descriptions.splice(i,1);
            }
            const label=descriptions.length?`[Video: ${descriptions.join(' — ')}]`:'[Video]';
            // If a recognized video is wrapped in a link, avoid nesting anchors.
            // Preserve non-video parent hyperlinks that have unrelated authored text.
            const onlyPlayer=parentLink&&!text(parentLink.textContent.replace(el.textContent,''));
            if(parentLink&&onlyPlayer&&parentLink!==el){
                // Treat only media wrappers as video destinations; do not repurpose article links with prose.
                if(shouldLink){if(!protectedEmbed||!parentURL)parentLink.setAttribute('href',dest.href);parentLink.setAttribute(marker,'true');retained++;}
                else if(!protectedEmbed){if(parentLink.hasAttribute('href'))stripped++;parentLink.removeAttribute('href');parentLink.setAttribute(marker,'true');}
                replacement.textContent=label;
            } else if(shouldLink&&!parentLink) {
                const a=document.createElement('a');a.href=dest.href;a.textContent=label;a.setAttribute(marker,'true');replacement.append(a);retained++;
            } else {
                replacement.textContent=label;
                if(shouldLink&&parentLink&&videoURL(parentURL)){parentLink.setAttribute(marker,'true');}
            }
            // Preserve IDs and caption/reference hyperlinks inside recognized captions.
            // Caption text is already represented; retain richer caption markup instead when it contains links.
            const extras=[];
            for(const c of richCaptions){const extra=document.createElement('span');copyId(c,extra);extra.append(...c.childNodes);extras.push(extra);}
            if(!parentLink)for(const extra of extras)replacement.append(document.createTextNode(' '),extra);
            for(const image of el.querySelectorAll('img')){thumbs++;if(safeURL(image.getAttribute('data-src'),article.url)||safeURL(image.getAttribute('src'),article.url))stats.imagesWithURL++;}
            if(!dest)noURL++;
            el.replaceWith(replacement);
            if(parentLink&&extras.length)parentLink.after(...extras);
            embeds++;
        }
        // Plain links to video platforms, direct video files and recognizable video subpages.
        for(const a of [...root.querySelectorAll('a[href]')]) {
            if(!root.contains(a)||a.getAttribute(marker)==='true')continue;
            const u=safeURL(a.getAttribute('href'),article.url);
            if(!videoURL(u)||isProtected(a,u))continue;
            // A thumbnail linked to a video should not be processed by the image policy later.
            const imgs=[...a.querySelectorAll('img')];
            if(imgs.length){
                const desc=imgs.map(i=>useful(i.getAttribute('alt')||i.getAttribute('title'))).filter(Boolean);
                for(const image of imgs){thumbs++;if(safeURL(image.getAttribute('data-src'),article.url)||safeURL(image.getAttribute('src'),article.url))stats.imagesWithURL++;image.remove();}
                if(!text(a.textContent))a.textContent=desc.length?`[Video: ${[...new Set(desc)].join(' — ')}]`:'[Video]';
            }
            if(/^https?:\/\/\S+$/i.test(text(a.textContent))||!text(a.textContent))a.textContent='[Video]';
            if(keep){a.setAttribute(marker,'true');retained++;}
            else {unwrap(a);stripped++;}
        }
        Object.assign(stats,{videoPlayersReplaced:embeds,videoLinksRemoved:stripped,videoLinksRetained:retained,videoThumbnailsOmitted:thumbs,videoPlayersWithoutURL:noURL});
        const warnings=[];
        if(embeds||stripped||retained)warnings.push(`Video policy: ${labels[mode]}; ${embeds} player(s) replaced, ${stripped} video hyperlink(s) stripped, ${retained} retained, ${thumbs} player thumbnail(s) omitted. No video bytes downloaded.`);
        if(noURL)warnings.push(`${noURL} player(s) had no recognizable video URL; titles/captions retained where available. See source for playback.`);
        return warnings;
    }
    return {modes,labels,normalize,apply};
})();
