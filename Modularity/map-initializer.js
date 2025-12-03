// map-initializer.js

/**
 * Leafletマップの初期化と基本レイヤーの設定を行うモジュール
 */

// グローバルな変数として定義（他のモジュールで使用するため）
let map;
let polygonLayerGroup;
let markerLayerGroup;
let tibanLayerGroup;

// グローバル変数
// Leaflet, turf はHTML側でCDNから読み込まれている前提

/**
 * マップを初期化し、レイヤーグループとコントロールを設定する
 * @param {string} mapId マップを表示するDOM要素のID
 * @param {object} initialView 初期表示の中心座標とズームレベル
 */
function initializeMap(mapId = "map", initialView = { center: [35.404, 132.825], zoom: 17 }) {
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
    const esriSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Tiles © Esri" });

    map = L.map(mapId, { 
        center: initialView.center, 
        zoom: initialView.zoom, 
        layers: [osm], 
        renderer: L.svg() 
    });

    // レイヤーグループの作成と地図への追加
    polygonLayerGroup = L.layerGroup().addTo(map);
    markerLayerGroup = L.layerGroup().addTo(map);
    tibanLayerGroup = L.layerGroup().addTo(map);

    // レイヤーコントロールの追加
    L.control.layers({ "地図": osm, "衛星画像": esriSat }, { "筆ポリゴン": polygonLayerGroup, "農地ピン": markerLayerGroup, "地番ラベル": tibanLayerGroup }).addTo(map);
    
    // ダブルクリックズームを無効化
    map.doubleClickZoom.disable();

    // マップサイズ再計算（サイドバーがあるため必要）
    setTimeout(() => map.invalidateSize(), 100);

    // ポリゴンレイヤー追加時にスタイルを復元するイベントを設定
    map.on('overlayadd', (e) => { 
        if (e.layer === polygonLayerGroup && typeof restorePolygonStyle === 'function') {
            polygonLayerGroup.eachLayer(restorePolygonStyle); 
        }
    });

    return map;
}

// 他のモジュールから参照できるようにエクスポート（グローバル変数として定義済み）
// export { map, polygonLayerGroup, markerLayerGroup, tibanLayerGroup, initializeMap };