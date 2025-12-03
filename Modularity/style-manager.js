// style-manager.js

/**
 * 圃場の色塗りスタイルと凡例の管理を行うモジュール
 * map-initializer.js が読み込まれている必要がある
 */

// グローバルな変数として定義（他のモジュールで使用するため）
let styleMap = {
    "主食用きぬむすめ": { color: "#90ee90", hatched: false },
    "主食用つや姫": { color: "#ffc0cb", hatched: false },
    "主食用つきあかり": { color: "#add8e6", hatched: false },
    "主食用コシヒカリ": { color: "#6a5acd", hatched: false },
    "稲WCS用きぬむすめ": { color: "#90ee90", hatched: true },
    "稲WCS用つきはやか": { color: "#9acd32", hatched: true },
    "稲WCS用たちすずか": { color: "#d2b48c", hatched: true },
    "稲WCS用ヒメノモチ": { color: "#ffb6c1", hatched: true },
    "飼料用米": { color: "#dda0dd", hatched: true },
    "大麦": { color: "#ffcc99", hatched: false },
    "小麦": { color: "#ff8c00", hatched: false },
    "ブロッコリー": { color: "#228b22", hatched: false },
    "タマネギ": { color: "#deb887", hatched: false },
    "飼料用トウモロコシ": { color: "#ffff00", hatched: true },
    "はとむぎ": { color: "#654321", hatched: false },
    "さつまいも": { color: "#800080", hatched: false },
    "大豆": { color: "#f4a300", hatched: false },
    "その他": { color: "#bdbdbd", hatched: true }
};
let cropOrder = Object.keys(styleMap);

// ユーティリティ関数 (dom-handler.js のものが分離されていると仮定し、ここでは再定義)
function normalizeCrop(name) {
    if (name === null || name === undefined) return "";
    return String(name).replace(/\u3000/g, " ").replace(/\s+/g, "").trim();
}

/**
 * 作物の名前からハッチングが必要か判定する
 * @param {string} cropName 作物名
 * @returns {boolean} ハッチングが必要な場合は true
 */
function isHatchedCrop(cropName) {
    const n = normalizeCrop(cropName);
    if (!n) return false;
    if (styleMap[n] && typeof styleMap[n].hatched !== "undefined") return !!styleMap[n].hatched;
    return n.includes("飼料用") || n.includes("WCS用"); // 後方互換
}

/**
 * ハッチング色決定のため、WCS用作物名から主食用ベース名を推測する
 * @param {string} cropName 作物名
 * @returns {string} ベースとなる作物名
 */
function getBaseCropNameForHatching(cropName) {
    const crop = normalizeCrop(cropName);
    if (crop && crop.startsWith("稲WCS用")) {
        const variety = crop.replace("稲WCS用", "");
        const candidate = `主食用${variety}`;
        if (styleMap[candidate]) return candidate;
    }
    return crop;
}

/**
 * SVGパターンを地図のSVG rendererに注入する
 */
function injectSvgHatchPattern(mapInstance, patternId, backgroundColor) {
    if (!mapInstance || !mapInstance.getRenderer) return;
    const renderer = mapInstance.getRenderer(mapInstance);
    if (!renderer || !renderer._container) return;
    const svg = renderer._container;
    let defs = svg.querySelector("defs");
    if (!defs) {
        defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        svg.insertBefore(defs, svg.firstChild);
    }
    if (defs.querySelector(`#${patternId}`)) return;

    const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute("id", patternId);
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    pattern.setAttribute("width", "10");
    pattern.setAttribute("height", "10");

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "0"); rect.setAttribute("y", "0");
    rect.setAttribute("width", "10"); rect.setAttribute("height", "10");
    rect.setAttribute("fill", backgroundColor);
    pattern.appendChild(rect);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "0"); line.setAttribute("y1", "0");
    line.setAttribute("x2", "10"); line.setAttribute("y2", "10");
    line.setAttribute("stroke", "#000"); line.setAttribute("stroke-width", "1");
    line.setAttribute("stroke-opacity", "0.45");
    pattern.appendChild(line);

    defs.appendChild(pattern);
}

/**
 * ポリゴン描画スタイルを取得する
 * @param {string} cropName 作物名
 * @param {boolean} isSelected 選択状態かどうか
 * @returns {object} Leaflet L.Path.setStyle に渡すスタイルのオブジェクト
 */
function getPolygonRenderStyle(cropName, isSelected = false) {
    let currentFill, currentFillOpacity = "0.7", currentStroke = "#d00", currentStrokeWidth = "2";
    
    if (isSelected) { 
        currentStroke = "#0057ff"; currentStrokeWidth = "4"; 
    }

    const n = normalizeCrop(cropName);
    
    if (!n) { 
        currentFill = "transparent"; currentFillOpacity = "0.0"; 
    }
    else if (isHatchedCrop(n)) {
        const base = getBaseCropNameForHatching(n);
        const bg = (styleMap[base] && styleMap[base].color) || (styleMap[n] && styleMap[n].color) || "#e88";
        
        // Leafletが初期化されていれば、SVGパターンを注入してURLを返す
        if (map) {
            const safeId = (base || n).split('').map(c => c.charCodeAt(0)).join('-');
            const pid = `hatch-${safeId}-${map._leaflet_id}`;
            injectSvgHatchPattern(map, pid, bg);
            currentFill = `url(#${pid})`;
        } else { 
            // マップがない場合は単色でフォールバック (テスト用など)
            currentFill = bg; 
        }
    } else {
        currentFill = (styleMap[n] && styleMap[n].color) || "#e88";
    }

    return { fill: currentFill, fillOpacity: currentFillOpacity, stroke: currentStroke, strokeWidth: currentStrokeWidth };
}

/**
 * 全ポリゴンのスタイルを更新（SelectedCropプロパティに従って）
 * @param {L.Path} lyr Leafletレイヤーオブジェクト
 */
function restorePolygonStyle(lyr) {
    const crop = normalizeCrop(lyr.feature.properties?.SelectedCrop);
    const style = getPolygonRenderStyle(crop, false);
    
    // SVGレンダラーの場合（_pathがある場合）
    if (lyr._path) {
        lyr._path.setAttribute('fill', style.fill);
        lyr._path.setAttribute('fill-opacity', style.fillOpacity);
        lyr._path.setAttribute('stroke', style.stroke);
        lyr._path.setAttribute('stroke-width', style.strokeWidth);
    } else {
        // Canvasレンダラーの場合や、ポリゴンレイヤーに追加された直後の場合
        const base = getBaseCropNameForHatching(crop);
        const fillColor = (style.fill === "transparent" ? "transparent" : ((styleMap[base] && styleMap[base].color) || style.fill || "#e88"));
        lyr.setStyle({
            color: style.stroke,
            weight: Number(style.strokeWidth),
            fillColor: fillColor,
            fillOpacity: parseFloat(style.fillOpacity)
        });
    }
}

/**
 * 凡例のDOMを生成・更新する (dom-handler.js のユーティリティが必要)
 */
function createCropLegend() {
    // escapeHtml は dom-handler.js にあると仮定する
    if (typeof escapeHtml !== 'function') {
        console.error("Error: escapeHtml function is not defined. Load dom-handler.js first.");
        return;
    }
    
    const legendDiv = document.getElementById("legend");
    if (!legendDiv) return;
    
    let html = "";
    cropOrder.forEach((crop, i) => {
        const displayName = crop;
        const info = styleMap[displayName] || { color: "#e88", hatched: false };
        const hatchClass = info.hatched ? "legend-hatch" : "";
        const color = info.color || "#e88";
        html += `<label>
            <input type="radio" name="crop" value="${escapeHtml(displayName)}" ${i===0 ? "checked":""}>
            <span class="color-box ${hatchClass}" style="background-color:${color};"></span>${escapeHtml(displayName)}
        </label>`;
    });
    legendDiv.innerHTML = html;
}

/**
 * CSVテキストをパースし、新しいスタイルマップを返す
 * @param {string} text CSVテキスト
 * @returns {Array<object>|null} パースされたスタイル定義の配列
 */
function parseCsvStyle(text) {
    if (!text) return null;
    text = text.replace(/^\uFEFF/, "");
    const rows = text.split(/\r\n|\n|\r/).filter(r => r.trim() !== "");
    if (rows.length === 0) return [];
    
    const header = rows[0].split(",").map(h => h.trim().toLowerCase());
    const nameIdx = header.findIndex(h => h === "name" || h === "名称" || h === "name_raw");
    const colorIdx = header.findIndex(h => h === "color" || h === "色" || h === "colour");
    const hatchedIdx = header.findIndex(h => h === "hatched" || h === "hatch" || h === "斜線");
    
    const results = [];
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(",").map(c => c.trim());
        if (cols.length === 0) continue;
        
        const row = {};
        row.name_raw = cols[nameIdx >= 0 ? nameIdx : 0] || cols[0] || "";
        row.name = row.name_raw;
        row.color = (colorIdx >= 0 ? (cols[colorIdx] || "") : (cols[1] || ""));
        row.hatched = (hatchedIdx >= 0 ? (cols[hatchedIdx] || "") : (cols[2] || ""));
        results.push(row);
    }
    return results;
}

// 他のモジュールから参照できるようにエクスポート
// export { styleMap, cropOrder, getPolygonRenderStyle, restorePolygonStyle, createCropLegend, parseCsvStyle, normalizeCrop, isHatchedCrop, getBaseCropNameForHatching };