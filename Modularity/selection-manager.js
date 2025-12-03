// selection-manager.js

/**
 * ピンの選択、集計、情報パネル表示の管理を行うモジュール
 * map-initializer.js, style-manager.js, dom-handler.js が読み込まれている必要がある
 */

// グローバルな変数として定義（他のモジュールで使用するため）
let selectedFeatures = []; 

// 外部モジュールからの依存関係（グローバル変数として定義済みを想定）
// propertyLabels, escapeHtml, normalizeCrop は dom-handler.js から
// map, updateAreaTable は本モジュールに記述

/**
 * ピンまたは圃場の選択状態をトグルまたは強制的に変更する
 * @param {L.Marker|L.Polygon} layer 選択対象のLeafletレイヤー
 * @param {boolean|null} forceState true:追加, false:削除, null:トグル
 */
function toggleFeatureSelection(layer, forceState = null) {
    const isPin = layer.feature.geometry.type === "Point";
    const idx = selectedFeatures.findIndex(sel => sel.lyr === layer);
    let isAdded = false;

    if (forceState === true) {
        if (idx === -1) { selectedFeatures.push({ lyr: layer, feature: layer.feature }); isAdded = true; }
    } else if (forceState === false) {
        if (idx >= 0) selectedFeatures.splice(idx, 1);
    } else { // toggle
        if (idx >= 0) selectedFeatures.splice(idx, 1);
        else { selectedFeatures.push({ lyr: layer, feature: layer.feature }); isAdded = true; }
    }

    updateAreaTable();

    // ピンが追加・選択された場合、詳細パネルを更新する
    if (isPin && (isAdded || (forceState === null && idx === -1))) {
        const props = layer.feature.properties || {};
        let html = "<table>";
        for (const key in props) {
            const jp = propertyLabels[key] || key; // propertyLabels は dom-handler.js から
            html += `<tr><td>${jp}</td><td>${escapeHtml(props[key] ?? "")}</td></tr>`; // escapeHtml は dom-handler.js から
        }
        html += "</table>";
        document.getElementById("propertyDetails").innerHTML = html;
        document.getElementById("infoPanel").classList.add("open");
    }
}

/**
 * 選択されているピンの集計結果をDOMに表示する
 */
function updateAreaTable() {
    // Point（ピン）のみを集計対象とする
    const selectedPins = selectedFeatures.filter(item => item.feature.geometry.type === "Point");
    document.getElementById("pinCount").innerText = selectedPins.length;

    const detailsEl = document.getElementById("details");
    if (!detailsEl) return;

    if (selectedPins.length === 0) {
        detailsEl.innerHTML = "ピンまたは圃場(集計ON時)をクリック";
        document.getElementById("propertyDetails").innerHTML = ""; // 詳細パネルもクリア
        return;
    }

    // 地番順にソート
    selectedPins.sort((a, b) => {
        const tA = String(a.feature.properties.Tiban || "");
        const tB = String(b.feature.properties.Tiban || "");
        return tA.localeCompare(tB, undefined, {numeric: true});
    });

    let totalArea = 0;
    let html = "<table><thead><tr><th>地番</th><th>面積</th></tr></thead><tbody>";
    selectedPins.forEach((item) => {
        const props = item.feature?.properties || {};
        let area = parseFloat(props.AreaOnRegistry) || 0;
        totalArea += area;
        html += `<tr><td>${escapeHtml(props.Tiban || '-')}</td><td style="text-align:right;">${area.toLocaleString()}</td></tr>`;
    });
    html += "</tbody></table>";
    html += `<div style="color:#1565c0;font-weight:bold;margin-top:6px;text-align:right;">合計: ${totalArea.toLocaleString()} ㎡<br>(${ (totalArea/10000).toFixed(2) } ha)</div>`;
    detailsEl.innerHTML = html;
}

/**
 * 選択ピンと集計結果をクリアする
 */
function clearSelection() {
    selectedFeatures = []; 
    updateAreaTable();
    document.getElementById("propertyDetails").innerHTML = "";
}

// 他のモジュールから参照できるようにエクスポート
// export { selectedFeatures, toggleFeatureSelection, updateAreaTable, clearSelection };