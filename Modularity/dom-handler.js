// dom-handler.js

/**
 * DOM操作、イベントリスナーの設定、ユーティリティ関数を集めたモジュール
 * 他のすべてのモジュールが読み込まれている必要がある
 */

// グローバルな定数として定義（他のモジュールで使用するため）
const propertyLabels = {
    FarmCommitteeCd: "農業委員会コード", FarmCommitteeName: "農業委員会名", TodofukenCode: "都道府県コード",
    ShikuchosonCode: "市町村コード", OazaCode: "大字コード", ClassificationOfLandCodeName: "地目",
    ClassificationOfLand: "地目コード", AreaOnRegistry: "登記簿面積（㎡）", SectionOfNoushinhouCodeName: "農振法区分",
    SectionOfNoushinhou: "農振法区分コード", SectionOfToshikeikakuhouCodeName: "都市計画法区分",
    SectionOfToshikeikakuhou: "都市計画法区分コード", OwnerFarmIntentionCodeName: "所有者の農地に関する意向",
    OwnerFarmIntention: "所有者の農地に関する意向コード", FarmerIndicationNumberHash: "耕作者整理番号",
    KindOfRightCodeName: "権利の種類", KindOfRight: "権利の種類コード", CommencementDate: "存続期間（始期）",
    EndStagesDate: "存続期間（終期）", RightSettingContentsCodeName: "農地中間管理権の状況",
    RightSettingContents: "農地中間管理権コード", UsageSituationInvestigationDate: "利用状況調査日",
    UsageSituationInvestigationResultCodeName: "遊休農地かどうか", UsageSituationInvestigationResult: "遊休農地コード",
    UseIntentionInvestigationDate: "利用意向調査日", OwnerStatementIntentSurveyResultsCodeName: "遊休農地の所有者等の意向",
    OwnerStatementIntentSurveyResults: "遊休農地の所有者等の意向コード", UseIntentionAscertainmentResultCodeName: "所有者等の確知の状況",
    UseIntentionAscertainmentResult: "所有者等の確知コード", PublicNoticeDate: "公告日", RightOfMiddleManagement: "農地中間管理権裁定日",
    RecommendationContenDate: "勧告日", ActionOrderDate: "措置命令日", MayorPublicAnnouncementDate: "市町村長公示日",
    Address: "所在地・地番", Tiban: "地番", SectionOfPolygonCodeName: "ポリゴン区分", SectionOfPolygon: "ポリゴン区分コード",
    DaichoId: "台帳ID", daicho_shubetsu_cd: "台帳種別コード"
};

// 外部モジュールからの依存関係（グローバル変数として定義済みを想定）
// loadedFileNames は feature-processor.js から
// clearSelection は selection-manager.js から
// createCropLegend, parseCsvStyle, styleMap, cropOrder は style-manager.js から
// processGeoJSONFiles は feature-processor.js から
// map, polygonLayerGroup, markerLayerGroup は map-initializer.js から

/**
 * HTMLエスケープ処理
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

/**
 * 凡例で現在選択されている作物名を取得する
 * @returns {string|null} 選択された作物名
 */
function getSelectedCrop() {
    const c = document.querySelector('input[name="crop"]:checked');
    // normalizeCrop は style-manager.js にあると仮定
    return c ? normalizeCrop(c.value) : null; 
}

/**
 * 面積集計モードが有効かどうかを判定する
 * @returns {boolean} 有効な場合は true
 */
function isAreaCalcMode() { 
    const sw = document.getElementById("areaCalcSwitch");
    return sw ? sw.checked : false; 
}

/**
 * 読み込み済みファイル名表示を更新する
 */
function updateLoadedFileNamesDisplay() {
    const el = document.getElementById("loadedFileNamesDisplay");
    if(!loadedFileNames.length) { 
        el.innerHTML = "<em>ファイル未読み込み</em>"; 
        return; 
    }
    el.innerHTML = `<b>読込済(${loadedFileNames.length}):</b><ul>` + loadedFileNames.map(n=>`<li>${escapeHtml(n)}</li>`).join('') + "</ul>";
}

/**
 * DOM操作とイベントリスナーを設定する
 */
function setupEventListeners() {
    // 情報パネルのトグル
    document.getElementById("infoToggle").addEventListener("click", () => {
        document.getElementById("infoPanel").classList.toggle("open");
    });
    
    // 情報パネルのリサイザー
    const panel = document.getElementById("infoPanel"), resizer = document.getElementById("infoResizer");
    let isResizing = false;
    resizer.addEventListener("mousedown", () => { 
        isResizing = true; 
        document.body.style.cursor = "ew-resize"; 
    });
    document.addEventListener("mousemove", (e) => { 
        if(isResizing) {
            // 画面右端から見た位置で幅を調整 (右側の #info が画面右端にある想定)
            const rightPanelWidth = Math.min(Math.max(window.innerWidth - e.clientX, 200), 600);
            document.getElementById("info").style.width = rightPanelWidth + "px";
            document.getElementById("map").style.width = (window.innerWidth - rightPanelWidth) + "px";
        }
    });
    document.addEventListener("mouseup", () => { 
        isResizing = false; 
        document.body.style.cursor = "default"; 
        // マップサイズを調整
        if (map) map.invalidateSize();
    });

    // 集計クリアボタン
    document.getElementById("clearSelectedFeaturesBtn").addEventListener("click", function() {
        clearSelection(); // selection-manager.js から
        // ポリゴンの選択状態を解除してスタイル復元
        polygonLayerGroup.eachLayer(lyr => { // polygonLayerGroup は map-initializer.js から
            if (lyr.feature.properties && lyr.feature.properties.SelectedCrop) {
                lyr.feature.properties.SelectedCrop = null;
                restorePolygonStyle(lyr); // style-manager.js から
            }
        });
    });

    // GeoJSONファイル入力
    document.getElementById("fileInput").addEventListener("change", function(event) {
        processGeoJSONFiles(event.target.files); // feature-processor.js から
    });

    // GeoJSON 保存ボタン
    document.getElementById('outbtn').addEventListener('click', saveGeoJSON);

    // スタイルCSVファイル入力
    document.getElementById("styleFileInput").addEventListener("change", processStyleCSVFile);

    // 住所検索ボタン
    document.getElementById("searchBtn").addEventListener("click", searchAddress);
}

/**
 * GeoJSONをファイルとして保存する
 */
async function saveGeoJSON() {
    // polygonLayerGroup は map-initializer.js から
    const geojson = polygonLayerGroup.toGeoJSON();
    const dataStr = JSON.stringify(geojson, null, 2);
    const fname = `MapData_${new Date().getTime()}.geojson`;
    
    // ブラウザの File System Access API を利用した保存
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({ 
                suggestedName: fname, 
                types: [{description:'GeoJSON', accept:{'application/json':['.geojson']}}] 
            });
            const writable = await handle.createWritable(); 
            await writable.write(new Blob([dataStr], {type:'application/json'})); 
            await writable.close();
            alert('保存しました');
        } catch(e) {
            // ユーザーがキャンセルした場合など
            if (e.name !== 'AbortError') console.error("保存エラー:", e);
        }
    } else {
        // フォールバック（通常ダウンロード）
        const a = document.createElement('a'); 
        a.href = "data:text/json;charset=utf-8," + encodeURIComponent(dataStr);
        a.download = fname; 
        a.click();
    }
}

/**
 * スタイルCSVファイルを読み込み、スタイルを更新する
 */
function processStyleCSVFile(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const parsed = parseCsvStyle(text); // style-manager.js から
            
            if (!parsed || parsed.length === 0) {
                document.getElementById("styleFileNameDisplay").innerText = "読み込みに失敗しました（CSV形式を確認）";
                return;
            }
            
            const newStyleMap = {};
            parsed.forEach(row => {
                const name = normalizeCrop(row.name_raw); // style-manager.js から
                if (!name) return;
                const color = row.color || "#e88";
                const hatched = (String(row.hatched || "").toLowerCase() === "true" || String(row.hatched || "").toLowerCase() === "1");
                newStyleMap[name] = { color, hatched };
            });
            
            // 「その他」は常に残す
            if (!newStyleMap["その他"]) newStyleMap["その他"] = styleMap["その他"] || { color: "#bdbdbd", hatched: true }; // styleMap は style-manager.js から

            styleMap = newStyleMap;
            cropOrder = Object.keys(styleMap);
            createCropLegend(); // style-manager.js から
            document.getElementById("styleFileNameDisplay").innerText = `読み込み済: ${file.name}`;
            
            // 全ポリゴンのスタイルを更新
            polygonLayerGroup.eachLayer(restorePolygonStyle); // polygonLayerGroup は map-initializer.js から, restorePolygonStyle は style-manager.js から
            
        } catch(err) {
            document.getElementById("styleFileNameDisplay").innerText = `読み込みエラー: ${err}`;
            console.error("CSV処理エラー:", err);
        }
    };
    reader.readAsText(file, "utf-8");
}

/**
 * 住所検索を行い、該当するピンに移動・クリックする
 */
function searchAddress() {
    const inputVal = document.getElementById("searchInput").value.trim();
    if (!inputVal) {
        alert("住所を入力してください");
        return;
    }
    
    // 全角数字を半角に、スペースやハイフンを正規化
    const normalize = (str) => {
        if (!str) return "";
        return str.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
            .replace(/\s+/g, "").replace(/‐/g, "-").replace(/ー/g, "-").toLowerCase();
    };
    const targetAddr = normalize(inputVal);
    let foundLayer = null;

    // markerLayerGroup は map-initializer.js から
    markerLayerGroup.eachLayer(function(layer) {
        if (foundLayer) return;
        const props = layer.feature && layer.feature.properties;
        if (props && props.Address) {
            const dataAddr = normalize(props.Address);
            if (dataAddr.includes(targetAddr)) {
                foundLayer = layer;
            }
        }
    });

    if (foundLayer) {
        // map は map-initializer.js から
        map.setView(foundLayer.getLatLng(), 18);
        foundLayer.fire('click');
    } else {
        alert("該当する住所のピンが見つかりませんでした。\n・ファイルが読み込まれているか確認してください\n・住所の一部だけで試してみてください");
    }
}


// DOMContentLoaded イベントで初期処理を実行
document.addEventListener("DOMContentLoaded", function() {
    // map-initializer.js で map を初期化
    if (typeof initializeMap === 'function') {
        initializeMap();
    } else {
        console.error("Error: initializeMap function not found. map-initializer.js might not be loaded.");
        return;
    }

    // スタイル・凡例の初期設定
    if (typeof createCropLegend === 'function') {
        createCropLegend();
    } else {
        console.error("Error: createCropLegend function not found. style-manager.js might not be loaded.");
    }
    
    // ファイル名表示の初期化
    updateLoadedFileNamesDisplay();

    // イベントリスナーの設定
    setupEventListeners();
});

// 他のモジュールから参照できるようにエクスポート
// export { propertyLabels, escapeHtml, getSelectedCrop, isAreaCalcMode, updateLoadedFileNamesDisplay };