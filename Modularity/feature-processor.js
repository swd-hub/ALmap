// feature-processor.js

/**
 * GeoJSONファイルの読み込み、レイヤーの描画、クリックイベント処理を行うモジュール
 * map-initializer.js, style-manager.js, selection-manager.js が読み込まれている必要がある
 */

// 外部モジュールからの依存関係（グローバル変数として定義済みを想定）
// map, polygonLayerGroup, markerLayerGroup, tibanLayerGroup, restorePolygonStyle, normalizeCrop, getSelectedCrop, isAreaCalcMode は map-initializer.js, style-manager.js, dom-handler.js から
// toggleFeatureSelection は selection-manager.js から
let loadedFileNames = []; // dom-handler.js の変数と共有する

/**
 * GeoJSONファイルを読み込み、地図に描画する
 * @param {File[]} files 読み込むFileオブジェクトの配列
 */
function processGeoJSONFiles(files) {
    if (!files.length) return;
    let processed = 0;
    let lastLoadedPinLatLng = null;

    Array.from(files).forEach(file => {
        if (loadedFileNames.includes(file.name)) {
            alert(`「${file.name}」は読込済みです。`);
            if (++processed === files.length) {
                // updateLoadedFileNamesDisplay は dom-handler.js から
                if (typeof updateLoadedFileNamesDisplay === 'function') updateLoadedFileNamesDisplay();
                if (lastLoadedPinLatLng) map.setView(lastLoadedPinLatLng, 17);
            }
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const geojson = JSON.parse(e.target.result);
                L.geoJSON(geojson, {
                    onEachFeature: function(feature, lyr) {
                        if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
                            // --- ポリゴン処理 ---
                            polygonLayerGroup.addLayer(lyr);
                            restorePolygonStyle(lyr); // style-manager.js から
                            addTibanLabelForPolygon(feature, lyr);
                            lyr.on("click", (ev) => handlePolygonClick(ev, feature, lyr));
                        }
                        else if (feature.geometry.type === "Point") {
                            // --- ピン処理 ---
                            const latlng = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                            lastLoadedPinLatLng = latlng;
                            const marker = L.marker(latlng);
                            marker.feature = feature;
                            markerLayerGroup.addLayer(marker);
                            addTibanLabelForPoint(feature, latlng);
                            marker.on("click", (ev) => handlePinClick(ev, marker));
                        }
                    }
                });
                if (!loadedFileNames.includes(file.name)) loadedFileNames.push(file.name);
            } catch(err) { alert(`エラー: ${file.name}\n${err}`); }

            if (++processed === files.length) {
                if (typeof updateLoadedFileNamesDisplay === 'function') updateLoadedFileNamesDisplay();
                if (lastLoadedPinLatLng) map.setView(lastLoadedPinLatLng, 17);
            }
        };
        reader.readAsText(file);
    });
}

/**
 * ポリゴンクリック時のイベントハンドラ
 */
function handlePolygonClick(ev, feature, lyr) {
    L.DomEvent.stopPropagation(ev);
    const currentCrop = getSelectedCrop(); // dom-handler.js から
    let isSelectedNow = false;

    // 作物選択のトグル
    if (normalizeCrop(feature.properties.SelectedCrop) === normalizeCrop(currentCrop)) {
        feature.properties.SelectedCrop = null; 
        restorePolygonStyle(lyr); 
        isSelectedNow = false;
    } else {
        feature.properties.SelectedCrop = currentCrop;
        const style = getPolygonRenderStyle(currentCrop, true); // style-manager.js から
        // Leaflet Pathのスタイル更新（SVG/Canvas対応）
        if (lyr._path) {
            lyr._path.setAttribute('fill', style.fill); 
            lyr._path.setAttribute('fill-opacity', style.fillOpacity);
            lyr._path.setAttribute('stroke', style.stroke); 
            lyr._path.setAttribute('stroke-width', style.strokeWidth);
        } else {
            const base = getBaseCropNameForHatching(currentCrop); // style-manager.js から
            lyr.setStyle({ 
                fillColor: style.fill==="transparent"?"transparent":(styleMap[base]?styleMap[base].color:"#e88"), // styleMap は style-manager.js から
                color: style.stroke, 
                weight: Number(style.strokeWidth) 
            });
        }
        isSelectedNow = true;
    }

    // 面積集計モードの場合、内部のピンを選択/解除
    if (isAreaCalcMode()) { // dom-handler.js から
        const containedPins = [];
        // turf はHTML側でCDNから読み込まれている前提
        markerLayerGroup.eachLayer(m => { // markerLayerGroup は map-initializer.js から
            if (turf.booleanPointInPolygon(m.feature, feature)) {
                containedPins.push(m);
            }
        });

        if (containedPins.length > 0) {
            containedPins.forEach(pin => {
                toggleFeatureSelection(pin, isSelectedNow); // selection-manager.js から
            });
        }
    }
}

/**
 * ピンクリック時のイベントハンドラ
 */
function handlePinClick(ev, marker) {
    L.DomEvent.stopPropagation(ev);
    toggleFeatureSelection(marker, null); // selection-manager.js から
}

/**
 * ポリゴンに地番ラベルを付加する
 */
function addTibanLabelForPolygon(feature, lyr) {
    let center;
    // turf はHTML側でCDNから読み込まれている前提
    if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
        try {
            // ポリゴンの重心を計算
            const centroid = turf.centroid(feature);
            if (centroid && centroid.geometry && centroid.geometry.coordinates) {
                const [lon, lat] = centroid.geometry.coordinates;
                center = [lat, lon];
            }
        } catch (e) {
            // turf.centroidが失敗した場合、簡易な方法で一つ目の座標を取得
            let coords;
            if (feature.geometry.type === "Polygon") {
                coords = feature.geometry.coordinates && feature.geometry.coordinates[0] && feature.geometry.coordinates[0][0];
            } else {
                coords = feature.geometry.coordinates && feature.geometry.coordinates[0] && feature.geometry.coordinates[0][0] && feature.geometry.coordinates[0][0][0];
            }
            if (coords) center = [coords[1], coords[0]];
        }
    }
    
    if (center && feature.properties && feature.properties.Tiban) {
        tibanLayerGroup.addLayer(L.marker(center, { // tibanLayerGroup は map-initializer.js から
            icon: L.divIcon({className:"tiban-label", html:feature.properties.Tiban, iconSize:null}), interactive:false
        }));
    }
}

/**
 * ピンに地番ラベルを付加する
 */
function addTibanLabelForPoint(feature, latlng) {
    if (feature.properties && feature.properties.Tiban) {
        tibanLayerGroup.addLayer(L.marker(latlng, { // tibanLayerGroup は map-initializer.js から
            icon: L.divIcon({className:"tiban-label", html:feature.properties.Tiban, iconSize:null}), interactive:false
        }));
    }
}

// 他のモジュールから参照できるようにエクスポート
// export { loadedFileNames, processGeoJSONFiles };