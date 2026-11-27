// Explicit local collection save/load and opt-in history UI.
(() => {
    const $=id=>document.getElementById(id);
    const save=$("save-collection"), load=$("load-collection"), file=$("collection-file"), notice=$("archive-status");
    const history=$("history-enabled"), historyList=$("history-list"), clear=$("clear-history");
    function sync(){save.disabled=WikiCollection.busy || !$("article-list").querySelector('input[type="checkbox"]');}
    function preferences(){return {title:$("collection-title").value,query:$("article-search").value,searchMode:$("search-mode").value,sort:$("article-sort").value,selectedOnly:$("selected-only").checked,format:document.querySelector('input[name="export-format"]:checked').value,output:document.querySelector('input[name="output-mode"]:checked').value,preview:$("preview-export").checked,manifest:$("combined-manifest").checked,linkMode:$("link-mode").value};}
    function applyPreferences(p){
        // Restore controls directly: do not run search input listeners that overwrite selections.
        $("collection-title").value=typeof p.title==="string"?p.title.slice(0,120):"";
        $("article-search").value=typeof p.query==="string"?p.query.slice(0,2000):"";
        $("search-mode").value=["exact","fuzzy"].includes(p.searchMode)?p.searchMode:"exact";
        $("article-sort").value=["asc","desc","relevance"].includes(p.sort)?p.sort:"asc";
        $("selected-only").checked=p.selectedOnly===true;
        $("preview-export").checked=p.preview===true;
        $("combined-manifest").checked=p.manifest===true;
        $("link-mode").value=WikiLinks.normalize(p.linkMode);
        const fmt=Object.hasOwn(WikiArchive.formats,p.format)?p.format:"md";
        const mode=["combined","separate"].includes(p.output)?p.output:"combined";
        document.querySelector(`input[name="export-format"][value="${fmt}"]`).checked=true;
        document.querySelector(`input[name="output-mode"][value="${mode}"]`).checked=true;
        // The batch module refreshes dynamic labels without changing selection.
        document.dispatchEvent(new Event("collectionrestored"));
    }
    function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
    save.addEventListener("click",()=>{
        if(WikiCollection.busy || save.disabled)return;
        try {
            const prefs=preferences();const data=WikiCollection.snapshot(prefs);
            const base=(prefs.title||"Research Collection").replace(/[<>:"/\\|?*\x00-\x1f]/g,"_").trim().slice(0,100)||"Collection";
            download(data,`Wiki_${base}.wiki-collection.json`);
            notice.textContent=`Save requested for ${data.articles.length} article links. No article content is saved.`;
        } catch(e){notice.textContent=e.message;}
    });
    load.addEventListener("click",()=>{if(!WikiCollection.busy)file.click();});
    file.addEventListener("change",async()=>{
        const selected=file.files?.[0];file.value="";if(!selected)return;
        if(WikiCollection.busy || $("collection-controls").disabled)return;
        try {
            if(selected.size>8*1024*1024)throw new Error("Collection file exceeds 8 MB.");
            await WikiCollection.withLoad(async()=>{
                const data=JSON.parse(await selected.text());
                if($("article-list").children.length && !confirm("Replace the current collection with the saved file?"))return;
                const restored=WikiCollection.restore(data);
                applyPreferences(restored.preferences);
                notice.textContent=`Restored ${restored.count} article links and their selections. No network requests made.`;
            });
        }catch(e){notice.textContent=e.message;}
    });
    function renderHistory(){
        history.checked=WikiArchive.historyEnabled();historyList.replaceChildren();
        const entries=WikiArchive.readHistory();clear.disabled=entries.length===0;
        if(!entries.length){const p=document.createElement("p");p.textContent="No recorded exports.";historyList.append(p);return;}
        for(const entry of entries){const li=document.createElement("li");const date=new Date(entry.time);li.textContent=`${Number.isFinite(date.getTime())?date.toLocaleString():"Unknown time"} — ${entry.format.toUpperCase()}, ${entry.mode}, ${entry.count} article(s)${entry.partial?" (partial)":""}; download requested`;historyList.append(li);}
    }
    history.addEventListener("change",()=>{WikiArchive.setHistoryEnabled(history.checked);renderHistory();});
    clear.addEventListener("click",()=>{WikiArchive.clearHistory();renderHistory();});
    document.addEventListener("collectionchange",()=>{sync();renderHistory();});
    document.addEventListener("exporthistorychange",renderHistory);
    window.addEventListener("storage",e=>{if(e.key?.startsWith("wiki-exporter:archive-history"))renderHistory();});
    sync();renderHistory();
})();
