import {useMemo} from "react";
import {Decoration, DecorationSet, EditorView, hoverTooltip, ViewPlugin, ViewUpdate} from "@codemirror/view";
import {Prec, RangeSetBuilder} from "@codemirror/state";
import {Database} from "@/types.ts";
import {getResourceMap} from "@/utils/mappingEngine";

export const useDbIdHighlighter = (databases: Database[], selectedDbs: Database[] = [], overrideScopingFormId?: string) => {
    return useMemo(() => {
        if (!databases || databases.length === 0) return [];

        const dbHighlight = Decoration.mark({
            class: "cm-dbid-highlight",
            attributes: { style: "color: #106ba3 !important; background-color: rgba(16, 107, 163, 0.1); border-bottom: 1px dashed #106ba3; cursor: help; font-weight: 600 !important;" }
        });

        const resHighlight = Decoration.mark({
            class: "cm-resid-highlight",
            attributes: { style: "color: #d9822b !important; background-color: rgba(217, 130, 43, 0.1); border-bottom: 1px dashed #d9822b; cursor: help; font-weight: 600 !important;" }
        });

        const fieldHighlight = Decoration.mark({
            class: "cm-fieldid-highlight",
            attributes: { style: "color: #37b24d !important; background-color: rgba(55, 178, 77, 0.1); border-bottom: 1px dashed #37b24d; cursor: help; font-weight: 600 !important;" }
        });

        const potentialHighlight = Decoration.mark({
            class: "cm-potentialid-highlight",
            attributes: { style: "color: #db3737 !important; background-color: rgba(219, 55, 55, 0.05); border-bottom: 1px dashed #db3737; cursor: help; font-weight: 600 !important;" }
        });

        const plugin = ViewPlugin.fromClass(class {
            decorations: DecorationSet;
            constructor(view: EditorView) { this.decorations = this.getDecorations(view); }
            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) this.decorations = this.getDecorations(update.view);
            }
            getDecorations(view: EditorView) {
                const docText = view.state.doc.toString();
                const resourceMap = getResourceMap(docText, databases, selectedDbs, overrideScopingFormId);
                const ids = Array.from(resourceMap.keys()).filter(id => id.length > 3).sort((a, b) => b.length - a.length);
                if (ids.length === 0) return Decoration.none;

                const regex = new RegExp(ids.join('|'), 'g');
                const builder = new RangeSetBuilder<Decoration>();
                for (const { from, to } of view.visibleRanges) {
                    const text = view.state.doc.sliceString(from, to);
                    let match;
                    regex.lastIndex = 0;
                    while ((match = regex.exec(text)) !== null) {
                        const info = resourceMap.get(match[0]);
                        let decoration = resHighlight;
                        if (info?.type === "POTENTIAL") decoration = potentialHighlight;
                        else if (info?.type === 'DATABASE') decoration = dbHighlight;
                        else if (info?.type === 'FIELD') decoration = fieldHighlight;
                        builder.add(from + match.index, from + match.index + match[0].length, decoration);
                    }
                }
                return builder.finish();
            }
        }, { decorations: v => v.decorations });

        const tooltip = hoverTooltip((view, pos) => {
            const docText = view.state.doc.toString();
            const resourceMap = getResourceMap(docText, databases, selectedDbs, overrideScopingFormId);
            const ids = Array.from(resourceMap.keys()).filter(id => id.length > 3).sort((a, b) => b.length - a.length);
            if (ids.length === 0) return null;

            const regex = new RegExp(ids.join('|'), 'g');
            const line = view.state.doc.lineAt(pos);
            const text = line.text;
            let match;
            regex.lastIndex = 0;
            while ((match = regex.exec(text)) !== null) {
                const start = line.from + match.index;
                const end = start + match[0].length;
                if (pos >= start && pos <= end) {
                    const id = match[0];
                    const info = resourceMap.get(id);
                    if (info) {
                        return {
                            pos: start, end: end, above: true,
                            create() {
                                let dom = document.createElement("div");
                                dom.style.padding = "10px";
                                dom.style.backgroundColor = info.type === "POTENTIAL" ? "#db3737" : (info.type === 'DATABASE' ? "#106ba3" : (info.type === 'FIELD' ? "#37b24d" : "#d9822b"));
                                dom.style.color = "white";
                                dom.style.borderRadius = "4px";
                                dom.style.fontSize = "11px";
                                dom.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";

                                let headerDiv = document.createElement("div");
                                headerDiv.style.display = "flex";
                                headerDiv.style.alignItems = "center";
                                headerDiv.style.gap = "8px";
                                headerDiv.style.flexWrap = "wrap";
                                headerDiv.style.marginBottom = info.translations.length > 0 ? "8px" : "0px";
                                headerDiv.style.justifyContent = "space-between";
                                
                                let labelSpan = document.createElement("span");
                                labelSpan.style.fontWeight = "bold";
                                labelSpan.style.fontSize = "13px";
                                labelSpan.textContent = info.label;
                                
                                let typeTag = document.createElement("span");
                                typeTag.style.fontSize = "9px";
                                typeTag.style.opacity = "0.8";
                                typeTag.style.backgroundColor = "rgba(255,255,255,0.15)";
                                typeTag.style.padding = "1px 6px";
                                typeTag.style.borderRadius = "10px";
                                typeTag.style.border = "1px solid rgba(255,255,255,0.2)";
                                typeTag.textContent = info.type;

                                headerDiv.appendChild(labelSpan);
                                headerDiv.appendChild(typeTag);
                                if (info.code) {
                                    let codeSpan = document.createElement("span");
                                    codeSpan.style.fontSize = "9px";
                                    codeSpan.style.backgroundColor = "rgba(217, 130, 43, 0.2)";
                                    codeSpan.style.padding = "1px 6px";
                                    codeSpan.style.borderRadius = "10px";
                                    codeSpan.style.border = "1px solid rgba(255,255,255,0.2)";
                                    codeSpan.textContent = "Code: " + info.code;
                                    headerDiv.appendChild(codeSpan);
                                }
                                dom.appendChild(headerDiv);

                                if (info.translations.length > 0) {
                                    let divider = document.createElement("div");
                                    divider.style.borderTop = "1px solid rgba(255,255,255,0.2)";
                                    divider.style.paddingTop = "8px";
                                    divider.style.marginTop = "4px";
                                    dom.appendChild(divider);

                                    let targetTitle = document.createElement("div");
                                    targetTitle.style.fontSize = "10px";
                                    targetTitle.style.opacity = "0.8";
                                    targetTitle.style.marginBottom = "6px";
                                    targetTitle.style.textTransform = "uppercase";
                                    targetTitle.style.fontWeight = "bold";
                                    targetTitle.textContent = "Target Mappings:";
                                    dom.appendChild(targetTitle);

                                    let table = document.createElement("table");
                                    table.style.width = "100%";
                                    table.style.borderCollapse = "collapse";
                                    table.className = "bp5-html-table bp5-html-table-condensed";
                                    table.style.backgroundColor = "transparent";
                                    table.style.color = "inherit";

                                    let tbody = document.createElement("tbody");
                                    info.translations.forEach(t => {
                                        let tr = document.createElement("tr");
                                        let tdName = document.createElement("td");
                                        tdName.style.padding = "4px 8px 4px 0";
                                        tdName.style.opacity = "0.8";
                                        tdName.style.verticalAlign = "middle";
                                        tdName.style.border = "none";
                                        tdName.style.color = "inherit";
                                        tdName.style.fontSize = "11px";
                                        tdName.textContent = t.targetDbName;
                                        
                                        let tdId = document.createElement("td");
                                        tdId.style.padding = "4px 0";
                                        tdId.style.textAlign = "right";
                                        tdId.style.verticalAlign = "middle";
                                        tdId.style.border = "none";
                                        
                                        let contentWrapper = document.createElement("div");
                                        contentWrapper.style.display = "flex";
                                        contentWrapper.style.flexDirection = "column";
                                        contentWrapper.style.alignItems = "flex-end";

                                        let idCode = document.createElement("code");
                                        idCode.style.backgroundColor = t.error ? "rgba(219, 55, 55, 0.25)" : "rgba(0,0,0,0.3)";
                                        idCode.style.padding = "2px 6px";
                                        idCode.style.borderRadius = "3px";
                                        idCode.style.color = t.error ? "#ff7373" : "#a7ffeb";
                                        idCode.style.wordBreak = "break-all";
                                        idCode.style.display = "inline-block";
                                        idCode.style.maxWidth = "180px";
                                        idCode.style.fontSize = "10px";
                                        idCode.style.whiteSpace = "nowrap";
                                        idCode.style.border = t.error ? "1px solid #db3737" : "none";
                                        idCode.textContent = t.targetId;

                                        contentWrapper.appendChild(idCode);
                                        if (t.error) {
                                            let errorMsg = document.createElement("span");
                                            errorMsg.style.fontSize = "8px";
                                            errorMsg.style.color = "#ff7373";
                                            errorMsg.style.marginTop = "2px";
                                            errorMsg.style.fontWeight = "bold";
                                            errorMsg.textContent = "NEW CUID";
                                            contentWrapper.appendChild(errorMsg);
                                        }
                                        tdId.appendChild(contentWrapper);
                                        tr.appendChild(tdName);
                                        tr.appendChild(tdId);
                                        tbody.appendChild(tr);
                                    });
                                    table.appendChild(tbody);
                                    dom.appendChild(table);
                                }
                                return { dom };
                            }
                        };
                    }
                }
            }
            return null;
        });

        return [Prec.highest(plugin), tooltip];
    }, [databases, selectedDbs, overrideScopingFormId]);
};
