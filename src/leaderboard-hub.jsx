import React, { startTransition, useEffect, useRef, useState } from "react";
import AtlasLookupPanel from "./atlas-lookup-panel.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const PAGE_SIZE = 10;

const COPY = {
  zh: {
    badge: "排行榜站点 Hub",
    title: "五站排行榜统一查询",
    intro:
      "把 Rustoria、Moose.GG、Rusticated、Survivors.gg 和 Atlas 收到同一块查询面板里。按站点标签切换来源，保留各站自己的服务器、wipe、周期、字段和 Steam64 查询差异。",
    independent: "这块查询不依赖上方 Steam 查询，可以直接单独使用。",
    useCurrentPlayer: "使用当前玩家昵称",
    useCurrentSteamId: "使用当前 Steam64",
    siteSource: "数据方式",
    siteScope: "数据覆盖",
    siteSpeed: "交互特性",
    servers: "服务器",
    types: "类型",
    currentRows: "当前行数",
    currentSite: "当前站点",
    currentServer: "当前服务器",
    currentType: "当前标签",
    currentSteamId: "当前 Steam64",
    server: "服务器",
    steam64: "Steam64",
    wipe: "Wipe",
    period: "周期",
    sortBy: "排序字段",
    sortDir: "排序方向",
    orderBy: "榜单方向",
    listFilter: "榜单过滤",
    playerLookup: "玩家汇总",
    lookupPlaceholder: "输入玩家名称",
    filterPlaceholder: "当前榜单内搜索玩家名",
    allCurrent: "当前/默认",
    desc: "降序",
    asc: "升序",
    load: "查询",
    apply: "应用过滤",
    stop: "停止",
    loadingCatalog: "正在加载站点目录...",
    loadingDetail: "正在同步服务器详情...",
    loadingBoard: "正在拉取榜单数据...",
    loadingPlayer: "正在汇总玩家跨类型数据...",
    emptyRows: "当前条件下没有榜单数据。",
    emptyPlayer: "输入玩家名后可跨全部类型聚合结果。",
    boardTitle: "榜单明细",
    boardCopy: "左侧按站点上下文选择服务器和类型，右侧查看当前榜单与跨类型玩家结果。",
    playerTitle: "玩家跨类型汇总",
    playerCopy: "同一玩家会在当前站点所有可查类型中做一次聚合。",
    fields: "字段",
    totalMatches: "命中类型",
    compareTarget: "当前榜单对比",
    playerCurrentType: "当前类型玩家结果",
    noMatch: "当前类型没有命中。",
    rank: "排名",
    player: "玩家",
    total: "Total",
    page: "页码",
    previous: "上一页",
    next: "下一页",
    sourceOfficial: "官方 API",
    sourcePublic: "公开 API",
    sourceLive: "实时页面抓取",
    scopeRustoria: "PVP / PVP+ / PVE / Resources / Building / Raiding / Loot / Farming / Vending / Scrap / Misc",
    scopeMoose: "PvP / PvE / Gambling / Resources / Building / Farming / Looting / Recycling / Boom / Vehicles / Vehicle Combat / Fishing",
    scopeRusticated: "PvP / Gathered Resources / 其他 leaderboard 统计组",
    scopeSurvivors: "Overall / PvP / Events / Gathering / Farming / Explosives / PvE NPC / PvE Animal / Gambling",
    scopeAtlas: "Steam64 -> 玩家画像 / BattleMetrics 时长 / Atlas 时长 / K/D / Accuracy / 封禁 / Clan History",
    speedRustoria: "最快，字段稳定，适合直接对接",
    speedMoose: "最慢，但能拿到页面真实列头和榜单",
    speedRusticated: "较快，支持 wipe 和字段排序",
    speedSurvivors: "实时页面驱动，支持服务器、Current Wipe / Lifetime 和玩家搜索",
    speedAtlas: "受站点反爬影响最大，只支持 Steam64 玩家画像查询",
    typeStatistics: "统计类型",
    typeCategories: "分类",
    typeGroups: "统计组",
    typePlayerLookup: "玩家画像",
    pickType: "标签",
    siteHintRustoria: "官方 leaderboard API，字段命名最稳定。",
    siteHintMoose: "真实页面抓取，切服和跨类型查询耗时会更长。",
    siteHintRusticated: "公开 API，可直接按 wipe 和排序字段调取。",
    siteHintSurvivors: "页面由 RankEval 驱动。当前支持服务器、Current Wipe / Lifetime、分类榜单和玩家聚合查询。",
    siteHintAtlas: "Atlas 公开查询页，只支持 Steam64。若 Atlas 拒绝访问，会直接显示站点真实报错。",
    noCurrentPlayer: "还没有载入上方 KDA 玩家。",
    noCurrentSteamId: "还没有载入上方 Steam64。",
    atlasLookupPlaceholder: "输入 17 位 Steam64 ID",
    atlasTitle: "Atlas 玩家画像",
    atlasCopy: "Atlas 不是服务器榜单，而是单玩家画像查询。这里会返回站点真实可见的玩家状态、时长、K/D、Accuracy、封禁和 Clan 记录。",
    atlasEmpty: "输入 Steam64 后可直接向 Atlas 玩家查询页发起请求。",
    atlasHighlights: "核心指标",
    atlasRecords: "记录摘要",
    atlasRecordsCopy: "下方展示 Atlas 当前能返回的封禁记录和 Clan 记录摘要。",
    profileUnavailable: "当前没有可展示的 Atlas 玩家画像。",
    status: "状态",
    profileMeta: "画像附加信息",
    openLink: "打开",
    bans: "封禁",
    clans: "Clan",
    noneLabel: "无",
    noBans: "无封禁记录",
    noClans: "无 Clan 历史",
    statsConsole: "Player Stats",
    statsConsoleCopy: "先选玩家、服务器和时间范围，再点下方标签切换到对应统计表。",
  },
  en: {
    badge: "Leaderboard Hub",
    title: "Unified Five-Site Query",
    intro:
      "Rustoria, Moose.GG, Rusticated, Survivors.gg, and Atlas are merged into one panel. Switch sources by site tags while keeping each site's own server, wipe, period, field, and Steam64 lookup model.",
    independent: "This panel works independently from the Steam query above.",
    useCurrentPlayer: "Use current player name",
    useCurrentSteamId: "Use current Steam64",
    siteSource: "Source",
    siteScope: "Coverage",
    siteSpeed: "Interaction",
    servers: "Servers",
    types: "Types",
    currentRows: "Rows",
    currentSite: "Site",
    currentServer: "Server",
    currentType: "Tag",
    currentSteamId: "Steam64",
    server: "Server",
    steam64: "Steam64",
    wipe: "Wipe",
    period: "Period",
    sortBy: "Sort By",
    sortDir: "Sort Dir",
    orderBy: "Order",
    listFilter: "Leaderboard Filter",
    playerLookup: "Player Summary",
    lookupPlaceholder: "Enter player name",
    filterPlaceholder: "Filter current leaderboard by player",
    allCurrent: "Current / Default",
    desc: "Desc",
    asc: "Asc",
    load: "Query",
    apply: "Apply",
    stop: "Stop",
    loadingCatalog: "Loading site catalog...",
    loadingDetail: "Syncing server detail...",
    loadingBoard: "Loading leaderboard...",
    loadingPlayer: "Aggregating player data across tags...",
    emptyRows: "No leaderboard rows for the current filters.",
    emptyPlayer: "Enter a player name to aggregate results across every available tag.",
    boardTitle: "Leaderboard",
    boardCopy: "Pick server and tag on the left, then inspect the current leaderboard and cross-tag player summary on the right.",
    playerTitle: "Cross-Tag Player Summary",
    playerCopy: "The same player is aggregated across every queryable tag for the active site.",
    fields: "Fields",
    totalMatches: "Matched Tags",
    compareTarget: "Current Leaderboard Focus",
    playerCurrentType: "Current Tag Player Result",
    noMatch: "No match in the current tag.",
    rank: "Rank",
    player: "Player",
    total: "Total",
    page: "Page",
    previous: "Prev",
    next: "Next",
    sourceOfficial: "Official API",
    sourcePublic: "Public API",
    sourceLive: "Live Page",
    scopeRustoria: "PVP / PVP+ / PVE / Resources / Building / Raiding / Loot / Farming / Vending / Scrap / Misc",
    scopeMoose: "PvP / PvE / Gambling / Resources / Building / Farming / Looting / Recycling / Boom / Vehicles / Vehicle Combat / Fishing",
    scopeRusticated: "PvP / Gathered Resources / other leaderboard groups",
    scopeSurvivors: "Overall / PvP / Events / Gathering / Farming / Explosives / PvE NPC / PvE Animal / Gambling",
    scopeAtlas: "Steam64 -> player dossier / BattleMetrics hours / Atlas hours / K/D / Accuracy / bans / clan history",
    speedRustoria: "Fastest. Stable fields and best for direct integration.",
    speedMoose: "Slowest, but captures the real live page columns and rows.",
    speedRusticated: "Fast with wipe support and sortable group fields.",
    speedSurvivors: "Live page driven, with server, Current Wipe / Lifetime, category leaderboard, and player lookup support.",
    speedAtlas: "Most limited by site protection. Steam64-only player dossier lookup.",
    typeStatistics: "Statistics",
    typeCategories: "Categories",
    typeGroups: "Groups",
    typePlayerLookup: "Player Dossier",
    pickType: "Tag",
    siteHintRustoria: "Official leaderboard API with the most stable field names.",
    siteHintMoose: "Live page scraping. Server switches and cross-tag searches take longer.",
    siteHintRusticated: "Public API with wipe and field-sort support.",
    siteHintSurvivors: "Powered by the RankEval page integration. Supports server, Current Wipe / Lifetime, category leaderboards, and player aggregation.",
    siteHintAtlas: "Atlas public lookup page. Steam64 only. If Atlas blocks the request, the real site error is shown.",
    noCurrentPlayer: "No KDA player loaded above yet.",
    noCurrentSteamId: "No Steam64 loaded above yet.",
    atlasLookupPlaceholder: "Enter a 17-digit Steam64 ID",
    atlasTitle: "Atlas Player Dossier",
    atlasCopy: "Atlas is not a server leaderboard. It exposes a single-player dossier with visible profile state, playtime, K/D, accuracy, bans, and clan history.",
    atlasEmpty: "Enter a Steam64 to run the live Atlas player lookup.",
    atlasHighlights: "Highlights",
    atlasRecords: "Record Summary",
    atlasRecordsCopy: "This section shows the ban and clan record summary currently visible on Atlas.",
    profileUnavailable: "No Atlas player dossier is available for the current lookup.",
    status: "Status",
    profileMeta: "Profile Meta",
    openLink: "Open",
    bans: "Bans",
    clans: "Clans",
    noneLabel: "None",
    noBans: "No ban records",
    noClans: "No clan history",
    statsConsole: "Player Stats",
    statsConsoleCopy: "Start with player, server, and time context, then switch the table through the tag row below.",
  },
};

const SITE_META = {
  rustoria: {
    id: "rustoria",
    name: "Rustoria",
    accent: "#4dd0b0",
    sourceKey: "sourceOfficial",
    scopeKey: "scopeRustoria",
    speedKey: "speedRustoria",
    typeKey: "typeStatistics",
    hintKey: "siteHintRustoria",
  },
  moose: {
    id: "moose",
    name: "Moose.GG",
    accent: "#5bbdff",
    sourceKey: "sourceLive",
    scopeKey: "scopeMoose",
    speedKey: "speedMoose",
    typeKey: "typeCategories",
    hintKey: "siteHintMoose",
  },
  rusticated: {
    id: "rusticated",
    name: "Rusticated",
    accent: "#ffb54a",
    sourceKey: "sourcePublic",
    scopeKey: "scopeRusticated",
    speedKey: "speedRusticated",
    typeKey: "typeGroups",
    hintKey: "siteHintRusticated",
  },
  survivors: {
    id: "survivors",
    name: "Survivors.gg",
    accent: "#ff6f47",
    sourceKey: "sourceLive",
    scopeKey: "scopeSurvivors",
    speedKey: "speedSurvivors",
    typeKey: "typeCategories",
    hintKey: "siteHintSurvivors",
  },
  atlas: {
    id: "atlas",
    name: "Atlas",
    accent: "#ff7a59",
    sourceKey: "sourceLive",
    scopeKey: "scopeAtlas",
    speedKey: "speedAtlas",
    typeKey: "typePlayerLookup",
    hintKey: "siteHintAtlas",
  },
};

const styles = `
.lb-shell {
  display: grid;
  gap: 18px;
}

.lb-hero {
  padding: 22px;
  display: grid;
  gap: 18px;
}

.lb-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  color: #89ddff;
  background: rgba(255,255,255,.03);
  font-size: 11px;
  letter-spacing: .14em;
  text-transform: uppercase;
}

.lb-title {
  font-size: clamp(26px, 3vw, 40px);
  font-weight: 800;
  letter-spacing: -.04em;
  color: var(--text-0);
}

.lb-copy {
  max-width: 72ch;
  line-height: 1.65;
  color: #97a7cb;
  font-size: 13px;
}

.lb-metrics,
.lb-site-grid,
.lb-item-grid,
.lb-player-grid,
.lb-compare-grid {
  display: grid;
  gap: 12px;
}

.lb-metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.lb-metric-card,
.lb-player-card,
.lb-compare-card,
.lb-field-chip,
.lb-site-card {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255,255,255,.025);
  border: 1px solid rgba(255,255,255,.06);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
}

.lb-metric-label,
.lb-card-label {
  display: block;
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #7d8cb2;
}

.lb-metric-value,
.lb-card-value {
  display: block;
  margin-top: 10px;
  font-size: 24px;
  font-weight: 800;
  color: #f2f7ff;
}

.lb-layout {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 18px;
}

.lb-sidebar,
.lb-main {
  display: grid;
  gap: 18px;
  align-content: start;
}

.lb-panel {
  padding: 20px;
}

.lb-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.lb-panel-title {
  font-size: 16px;
  font-weight: 700;
  color: #edf5ff;
}

.lb-panel-copy {
  margin-top: 6px;
  font-size: 12px;
  color: #8a98be;
  line-height: 1.6;
}

.lb-site-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.lb-site-card {
  text-align: left;
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}

.lb-site-card:hover {
  transform: translateY(-2px);
}

.lb-site-card.active {
  box-shadow: 0 16px 34px rgba(0,0,0,.24);
}

.lb-site-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.lb-site-name {
  font-size: 15px;
  font-weight: 800;
  color: #f4f8ff;
}

.lb-site-chip {
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
  border: 1px solid currentColor;
}

.lb-site-meta {
  margin-top: 10px;
  display: grid;
  gap: 8px;
  font-size: 12px;
  color: #a2b2d9;
  line-height: 1.55;
}

.lb-toolbar,
.lb-inline,
.lb-pagination,
.lb-summary-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.lb-control-stack {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.lb-stack {
  display: grid;
  gap: 18px;
}

.lb-console {
  padding: 0;
  overflow: hidden;
}

.lb-console-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  padding: 20px;
}

.lb-console-title {
  font-size: clamp(28px, 3vw, 40px);
  font-weight: 300;
  letter-spacing: -.04em;
  color: #f5f7fb;
}

.lb-console-copy {
  margin-top: 8px;
  max-width: 58ch;
  color: #8f9cbc;
  font-size: 12px;
  line-height: 1.65;
}

.lb-console-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
  align-items: end;
  flex: 1;
}

.lb-console-search {
  flex: 1 1 280px;
}

.lb-console-field {
  min-width: 220px;
  flex: 0 1 220px;
}

.lb-board-shell {
  padding: 0;
  overflow: hidden;
}

.lb-summary-shell {
  padding: 0;
  overflow: hidden;
}

.lb-board-top {
  padding: 0 18px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}

.lb-board-toolbar {
  padding: 14px 18px 0;
}

.lb-summary-body {
  padding: 18px;
  display: grid;
  gap: 16px;
}

.lb-summary-identity {
  display: flex;
  align-items: center;
  gap: 14px;
}

.lb-summary-name {
  font-size: 18px;
  font-weight: 700;
  color: #f2f7ff;
}

.lb-summary-id {
  margin-top: 4px;
  font-size: 12px;
  color: #8290b5;
}

.lb-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.lb-detail-item {
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.06);
  background: rgba(255,255,255,.025);
}

.lb-detail-label {
  display: block;
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #7d8cb2;
}

.lb-detail-value {
  display: block;
  margin-top: 8px;
  font-size: 18px;
  font-weight: 700;
  color: #f4f8ff;
}

.lb-primary-controls {
  align-items: end;
}

.lb-primary-controls .lb-inline,
.lb-toolbar.secondary .lb-inline {
  flex: 1 1 320px;
}

.lb-primary-controls .lb-field-group,
.lb-toolbar.secondary .lb-field-group {
  flex: 0 1 220px;
}

.lb-field-group {
  min-width: 160px;
  display: grid;
  gap: 8px;
}

.lb-field-label {
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #7d8cb2;
}

.lb-control,
.lb-button,
.lb-item-button {
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03);
  color: #eef5ff;
  transition: transform .16s ease, border-color .16s ease, background .16s ease;
}

.lb-control {
  width: 100%;
  padding: 12px 14px;
}

.lb-button,
.lb-item-button {
  cursor: pointer;
}

.lb-button {
  padding: 11px 14px;
}

.lb-button:hover,
.lb-item-button:hover {
  transform: translateY(-1px);
}

.lb-button.primary {
  background: linear-gradient(135deg, rgba(0,229,255,.18), rgba(179,136,255,.12));
}

.lb-item-grid {
  grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
}

.lb-item-button {
  padding: 13px 14px;
  text-align: left;
}

.lb-item-button small,
.lb-note,
.lb-subline {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  color: #8290b5;
}

.lb-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.lb-board-top .lb-tag-row {
  margin-top: 0;
  flex-wrap: nowrap;
  overflow-x: auto;
  padding: 0;
  gap: 0;
}

.lb-tag-button {
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03);
  color: #dce6ff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .04em;
  transition: transform .16s ease, border-color .16s ease, background .16s ease;
}

.lb-board-top .lb-tag-button {
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 16px 18px 17px;
  color: #9ba3b6;
  text-transform: uppercase;
  letter-spacing: .12em;
  font-size: 11px;
  position: relative;
  white-space: nowrap;
}

.lb-board-top .lb-tag-button::after {
  content: "";
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 0;
  height: 2px;
  border-radius: 999px;
  background: transparent;
}

.lb-tag-button:hover {
  transform: translateY(-1px);
}

.lb-board-top .lb-tag-button:hover {
  transform: none;
  color: #eef3ff;
}

.lb-board-top .lb-tag-button.active::after {
  background: currentColor;
}

.lb-status,
.lb-error {
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 12px;
  line-height: 1.6;
}

.lb-status {
  background: rgba(91, 189, 255, .08);
  border: 1px solid rgba(91, 189, 255, .16);
  color: #a8d7ff;
}

.lb-error {
  background: rgba(239, 83, 80, .08);
  border: 1px solid rgba(239, 83, 80, .16);
  color: #ffb2b0;
}

.lb-table-wrap {
  overflow: auto;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.05);
  background: rgba(255,255,255,.02);
}

.lb-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}

.lb-table th,
.lb-table td {
  padding: 13px 14px;
  border-bottom: 1px solid rgba(255,255,255,.05);
  text-align: left;
  vertical-align: top;
  font-size: 13px;
}

.lb-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgba(8, 8, 24, .96);
  color: #8ea0ca;
  font-size: 11px;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.lb-row-button {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  padding: 0;
}

.lb-row {
  transition: background .16s ease;
}

.lb-row:hover {
  background: rgba(255,255,255,.03);
}

.lb-row.active {
  background: rgba(255,255,255,.05);
}

.lb-player-cell {
  display: flex;
  gap: 12px;
  align-items: center;
}

.lb-avatar,
.lb-avatar-fallback {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  object-fit: cover;
  flex: none;
}

.lb-avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(0,229,255,.28), rgba(179,136,255,.22));
  color: white;
  font-weight: 800;
}

.lb-player-grid,
.lb-compare-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.lb-player-card strong,
.lb-compare-card strong {
  display: block;
  font-size: 16px;
  color: #f2f7ff;
}

.lb-player-card ul,
.lb-compare-card ul {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: grid;
  gap: 8px;
}

.lb-player-card li,
.lb-compare-card li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: #dce6ff;
}

.lb-player-card li span,
.lb-compare-card li span {
  color: #8391b4;
}

.lb-summary-chip {
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03);
  font-size: 12px;
  color: #cdd8ef;
}

@media (max-width: 1180px) {
  .lb-layout {
    grid-template-columns: 1fr;
  }

  .lb-console-head {
    flex-direction: column;
  }

  .lb-console-controls {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 900px) {
  .lb-metrics,
  .lb-site-grid {
    grid-template-columns: 1fr;
  }

  .lb-console-head {
    padding: 18px;
  }

  .lb-console-controls {
    justify-content: flex-start;
  }

  .lb-primary-controls .lb-inline,
  .lb-toolbar.secondary .lb-inline,
  .lb-primary-controls .lb-field-group,
  .lb-toolbar.secondary .lb-field-group,
  .lb-console-search,
  .lb-console-field {
    flex: 1 1 100%;
  }
}
`;

function buildUrl(path, params) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}`;
}

async function fetchJson(path, params, options = {}) {
  const response = await fetch(buildUrl(path, params), options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function formatDuration(value, locale) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds.toLocaleString(locale)}s`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function formatDateTime(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(locale, { hour12: false });
}

function formatMetric(value, field, locale) {
  if (value === null || value === undefined || value === "") return "—";
  if (field?.kind === "duration") return formatDuration(value, locale);
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    if (field?.kind === "percent") {
      return `${numeric.toLocaleString(locale, { maximumFractionDigits: 2 })}%`;
    }
    if (field?.kind === "ratio") {
      return numeric.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return numeric.toLocaleString(locale, {
      maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    });
  }
  return String(value);
}

function initialsFromName(value) {
  return String(value || "?").slice(0, 2).toUpperCase();
}

function rowKey(row) {
  return String(
    row?.rustoriaId ||
      row?.steamId ||
      row?.playerUrl ||
      row?.username ||
      row?.playerName ||
      ""
  );
}

function rowName(row) {
  return row?.username || row?.playerName || "—";
}

function rowAvatar(row) {
  return row?.avatar || row?.avatarUrl || "";
}

function rowValues(row) {
  return row?.data || row?.values || row?.stats || {};
}

function fieldValue(row, field) {
  if (!row || !field) return null;
  if (field.id === "total") return row.total ?? null;
  return rowValues(row)[field.id] ?? row[field.id] ?? null;
}

function getSiteItems(site, catalog, detail) {
  if (site === "atlas") return catalog?.playerFields || [];
  if (site === "rustoria") return detail?.server?.statistics || [];
  if (site === "moose" || site === "survivors") return detail?.categories || catalog?.categories || [];
  return detail?.groups || catalog?.groups || [];
}

function getSiteTypeCount(site, catalog, detail) {
  return getSiteItems(site, catalog, detail).length;
}

function getBoardRows(payload) {
  return payload?.rows || [];
}

function getBoardTotal(site, payload) {
  if (site === "rustoria") return payload?.totalItems || 0;
  if (site === "moose") return payload?.rows?.length || 0;
  if (site === "survivors") return payload?.total || 0;
  return payload?.total || 0;
}

function getPlayerBuckets(site, summary) {
  if (site === "rustoria") return summary?.statistics || [];
  if (site === "moose" || site === "survivors") return summary?.categories || [];
  return summary?.groups || [];
}

function getPlayerMatchedCount(site, summary) {
  if (site === "rustoria") return summary?.matchedStatistics || 0;
  if (site === "moose" || site === "survivors") return summary?.matchedCategories || 0;
  return summary?.matchedGroups || 0;
}

function getBucketId(site, bucket) {
  if (site === "rustoria") return bucket?.statistic?.id || "";
  if (site === "moose" || site === "survivors") return bucket?.category?.id || "";
  return bucket?.group?.id || "";
}

function getBucketName(site, bucket) {
  if (site === "rustoria") return bucket?.statistic?.name || "—";
  if (site === "moose" || site === "survivors") return bucket?.category?.name || "—";
  return bucket?.group?.name || "—";
}

function getBucketFields(site, bucket) {
  if (site === "rustoria") return bucket?.statistic?.fields || [];
  return bucket?.fields || [];
}

function normalizeCatalog(site, payload) {
  if (site === "rustoria") return { source: "https://rustoria.co/leaderboards", ...payload };
  if (site === "atlas") return { servers: [], playerFields: payload?.playerFields || [], ...payload };
  return payload;
}

function currentPageInfo(site, payload, page, offset) {
  if (site === "moose") {
    const current = payload?.pagination?.currentPage || page || 1;
    const hasPrev = Boolean(payload?.pagination?.hasPrevious) && current > 1;
    const hasNext = Boolean(payload?.pagination?.hasNext);
    return { current, hasPrev, hasNext };
  }
  if (site === "survivors") {
    const total = payload?.total || 0;
    const current = Math.max(1, page || 1);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return { current, hasPrev: current > 1, hasNext: current < totalPages, totalPages };
  }
  const total = site === "rustoria" ? payload?.totalItems || 0 : payload?.total || 0;
  const current = Math.floor((offset || 0) / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return { current, hasPrev: current > 1, hasNext: current < totalPages, totalPages };
}

function boardFields(site, payload) {
  const fields = payload?.fields || [];
  const hasTotal = site === "rustoria" && getBoardRows(payload).some((row) => row.total !== undefined && row.total !== null);
  return hasTotal ? [{ id: "total", name: "Total", kind: "number" }, ...fields] : fields;
}

function normalizeWipeOptions(site, wipes, locale) {
  return (wipes || []).map((wipe, index) => {
    if (wipe && typeof wipe === "object") {
      const value = wipe.id ?? wipe.startedAt ?? wipe.name ?? wipe.label ?? index;
      const label =
        wipe.label ||
        wipe.name ||
        wipe.title ||
        (wipe.startedAt ? formatDateTime(wipe.startedAt, locale) : String(value));
      return {
        key: `${site}-${String(value)}-${index}`,
        value: String(value),
        label,
      };
    }
    return {
      key: `${site}-${String(wipe)}-${index}`,
      value: String(wipe),
      label: String(wipe),
    };
  });
}

export default function LeaderboardHub({
  lang = "zh",
  locale = "zh-CN",
  preferredPlayerName = "",
  preferredSteamId = "",
}) {
  const t = COPY[lang] || COPY.zh;
  const [site, setSite] = useState(() => {
    if (typeof window === "undefined") return "rustoria";
    return window.localStorage.getItem("rust-kda-leaderboard-site") || "rustoria";
  });
  const [catalog, setCatalog] = useState(null);
  const [detail, setDetail] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [playerSummary, setPlayerSummary] = useState(null);
  const [error, setError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [serverId, setServerId] = useState("");
  const [entryId, setEntryId] = useState("");
  const [wipeId, setWipeId] = useState("");
  const [period, setPeriod] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("desc");
  const [orderBy, setOrderBy] = useState("desc");
  const [page, setPage] = useState(1);
  const [offset, setOffset] = useState(0);
  const [filterInput, setFilterInput] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [playerInput, setPlayerInput] = useState("");
  const [selectedCompareKey, setSelectedCompareKey] = useState("");
  const playerSearchControllerRef = useRef(null);

  useEffect(() => {
    if (!preferredPlayerName || playerInput) return;
    setPlayerInput(preferredPlayerName);
  }, [preferredPlayerName]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("rust-kda-leaderboard-site", site);
    }
  }, [site]);

  useEffect(() => {
    let alive = true;
    playerSearchControllerRef.current?.abort();
    playerSearchControllerRef.current = null;
    setCatalogLoading(true);
    setCatalog(null);
    setDetail(null);
    setLeaderboard(null);
    setPlayerSummary(null);
    setError("");
    setServerId("");
    setEntryId("");
    setWipeId("");
    setPeriod("");
    setSortBy("");
    setSortDir("desc");
    setOrderBy("desc");
    setPage(1);
    setOffset(0);
    setTableFilter("");
    setFilterInput("");
    setSelectedCompareKey("");

    const path =
      site === "rustoria"
        ? "/rustoria/servers"
        : site === "moose"
          ? "/moose/servers"
          : site === "rusticated"
            ? "/rusticated/servers"
            : site === "survivors"
              ? "/survivors/servers"
              : "/atlas/meta";

    fetchJson(path)
      .then((payload) => {
        if (!alive) return;
        const nextCatalog = normalizeCatalog(site, payload);
        setCatalog(nextCatalog);
        if (site === "atlas") return;
        const nextServer =
          nextCatalog.servers?.find((item) => item.active) ||
          nextCatalog.servers?.[0] ||
          null;
        startTransition(() => {
          setServerId(nextServer?.id || "");
          if (site === "moose" || site === "survivors") {
            setEntryId(nextCatalog.categories?.find((item) => item.active)?.id || nextCatalog.categories?.[0]?.id || "");
          } else if (site === "rusticated") {
            setEntryId(nextCatalog.groups?.[0]?.id || "");
          }
        });
      })
      .catch((fetchError) => {
        if (alive) {
          setCatalog(null);
          setError(fetchError.message);
        }
      })
      .finally(() => {
        if (alive) setCatalogLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [site]);

  useEffect(() => () => {
    playerSearchControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (site === "atlas") return;
    if (!serverId) return;
    let alive = true;
    setDetailLoading(true);

    const loader =
      site === "rustoria"
        ? Promise.all([
            fetchJson(`/rustoria/servers/${encodeURIComponent(serverId)}`),
            fetchJson(`/rustoria/servers/${encodeURIComponent(serverId)}/wipes`),
          ]).then(([serverPayload, wipePayload]) => ({
            ...serverPayload,
            wipes: wipePayload.wipes || [],
          }))
        : fetchJson(
            site === "moose"
              ? `/moose/servers/${encodeURIComponent(serverId)}`
              : site === "survivors"
                ? `/survivors/servers/${encodeURIComponent(serverId)}`
                : `/rusticated/servers/${encodeURIComponent(serverId)}`
          );

    loader
      .then((payload) => {
        if (!alive) return;
        setDetail(payload);
        startTransition(() => {
          if (site === "rustoria") {
            const nextItem = payload.server?.statistics?.find((item) => item.id === entryId) || payload.server?.statistics?.[0] || null;
            setEntryId(nextItem?.id || "");
            setSortBy(nextItem?.defaultSort || "");
            setOrderBy("desc");
            setWipeId("");
            setOffset(0);
          } else if (site === "moose" || site === "survivors") {
            const nextItem = (payload.categories || []).find((item) => item.id === entryId) || payload.categories?.[0] || null;
            const nextPeriod = (payload.periods || []).some((item) => (item.id || item.name) === period)
              ? period
              : payload.periods?.find((item) => item.active)?.id || payload.periods?.[0]?.id || payload.periods?.[0]?.name || "";
            setEntryId(nextItem?.id || "");
            setPeriod(nextPeriod);
            setPage(1);
          } else {
            const nextItem = (payload.groups || []).find((item) => item.id === entryId) || payload.groups?.[0] || null;
            setEntryId(nextItem?.id || "");
            setSortBy(nextItem?.defaultSort || "");
            setSortDir("desc");
            setWipeId(payload.defaultWipeId ? String(payload.defaultWipeId) : "");
            setOffset(0);
          }
          setSelectedCompareKey("");
        });
      })
      .catch((fetchError) => {
        if (alive) {
          setDetail(null);
          setError(fetchError.message);
        }
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [site, serverId]);

  useEffect(() => {
    if (site === "atlas") return;
    if (!serverId || !entryId) return;
    let alive = true;
    setBoardLoading(true);

    const path =
      site === "rustoria"
        ? `/rustoria/servers/${encodeURIComponent(serverId)}/leaderboards/${encodeURIComponent(entryId)}`
        : site === "moose"
          ? `/moose/servers/${encodeURIComponent(serverId)}/leaderboards/${encodeURIComponent(entryId)}`
          : site === "survivors"
            ? `/survivors/servers/${encodeURIComponent(serverId)}/leaderboards/${encodeURIComponent(entryId)}`
          : `/rusticated/servers/${encodeURIComponent(serverId)}/leaderboards/${encodeURIComponent(entryId)}`;

    const params =
      site === "rustoria"
        ? { from: offset, sortBy, orderBy, wipe: wipeId, username: tableFilter }
        : site === "moose" || site === "survivors"
          ? { period, search: tableFilter, page }
          : { wipeId, sortBy, sortDir, offset, limit: PAGE_SIZE, type: "player", filter: tableFilter };

    fetchJson(path, params)
      .then((payload) => {
        if (!alive) return;
        setLeaderboard(payload);
        const firstKey = rowKey(payload.rows?.[0]);
        setSelectedCompareKey((current) => {
          if (!current) return firstKey;
          return payload.rows?.some((row) => rowKey(row) === current) ? current : firstKey;
        });
      })
      .catch((fetchError) => {
        if (alive) {
          setLeaderboard(null);
          setError(fetchError.message);
        }
      })
      .finally(() => {
        if (alive) setBoardLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [site, serverId, entryId, wipeId, period, sortBy, sortDir, orderBy, offset, page, tableFilter]);

  const items = getSiteItems(site, catalog, detail);
  const currentItem = items.find((item) => item.id === entryId) || null;
  const rows = getBoardRows(leaderboard);
  const fields = boardFields(site, leaderboard);
  const pageInfo = currentPageInfo(site, leaderboard, page, offset);
  const buckets = getPlayerBuckets(site, playerSummary);
  const matchedBuckets = buckets.filter((bucket) => bucket?.selectedMatch);
  const currentBucket = matchedBuckets.find((bucket) => getBucketId(site, bucket) === entryId) || matchedBuckets[0] || null;
  const currentPlayerRow = currentBucket?.selectedMatch || null;
  const compareRow = rows.find((row) => rowKey(row) === selectedCompareKey) || rows[0] || null;
  const wipeOptions = normalizeWipeOptions(site, detail?.wipes || [], locale);
  const meta = SITE_META[site];
  const activeServerName = catalog?.servers?.find((item) => item.id === serverId)?.name || "—";
  const identityName =
    playerSummary?.identity?.username ||
    playerSummary?.identity?.playerName ||
    "";

  async function runPlayerSearch(event) {
    event?.preventDefault();
    if (site === "atlas") return;
    const username = playerInput.trim();
    if (!serverId || !username) return;
    playerSearchControllerRef.current?.abort();
    const controller = new AbortController();
    playerSearchControllerRef.current = controller;
    setPlayerLoading(true);
    setError("");
    try {
      const path =
        site === "rustoria"
          ? "/rustoria/player-search"
          : site === "moose"
            ? "/moose/player-search"
            : site === "survivors"
              ? "/survivors/player-search"
            : "/rusticated/player-search";
      const params =
        site === "rustoria"
          ? { serverId, username, wipe: wipeId }
          : site === "moose" || site === "survivors"
            ? { serverId, username, period }
            : { serverId, username, wipeId };
      const payload = await fetchJson(path, params, { signal: controller.signal });
      setPlayerSummary(payload);
    } catch (fetchError) {
      if (fetchError?.name !== "AbortError") {
        setPlayerSummary(null);
        setError(fetchError.message);
      }
    } finally {
      if (playerSearchControllerRef.current === controller) {
        playerSearchControllerRef.current = null;
      }
      setPlayerLoading(false);
    }
  }

  function stopPlayerSearch() {
    playerSearchControllerRef.current?.abort();
    playerSearchControllerRef.current = null;
    setPlayerLoading(false);
  }

  function applyCurrentFilter(event) {
    event?.preventDefault();
    if (site === "atlas") return;
    startTransition(() => {
      setTableFilter(filterInput.trim());
      if (site === "moose" || site === "survivors") {
        setPage(1);
      } else {
        setOffset(0);
      }
    });
  }

  function selectItem(nextId) {
    if (site === "atlas") return;
    const nextItem = items.find((item) => item.id === nextId) || null;
    startTransition(() => {
      setEntryId(nextId);
      setSelectedCompareKey("");
      if (site === "rustoria") {
        setSortBy(nextItem?.defaultSort || "");
        setOrderBy("desc");
        setOffset(0);
      } else if (site === "moose" || site === "survivors") {
        setPage(1);
      } else {
        setSortBy(nextItem?.defaultSort || "");
        setSortDir("desc");
        setOffset(0);
      }
    });
  }

  return (
    <>
      <style>{styles}</style>
      <div className="lb-shell">
        <section className="neon-panel lb-hero">
          <div>
            <div className="lb-kicker">{t.badge}</div>
            <div className="lb-title">{t.title}</div>
            <div className="lb-copy" style={{ marginTop: 12 }}>
              {t.intro}
            </div>
            <div className="lb-copy" style={{ marginTop: 8 }}>
              {preferredPlayerName ? (
                <>
                  {t.independent}
                  {" "}
                  <button
                    className="lb-button"
                    onClick={() => setPlayerInput(preferredPlayerName)}
                    style={{ marginLeft: 8 }}
                  >
                    {t.useCurrentPlayer}: {preferredPlayerName}
                  </button>
                </>
              ) : (
                `${t.independent} ${t.noCurrentPlayer}`
              )}
            </div>
          </div>

          <div className="lb-site-grid">
            {Object.values(SITE_META).map((item) => {
              const active = item.id === site;
              return (
                <button
                  key={item.id}
                  className={`lb-site-card ${active ? "active" : ""}`}
                  style={{
                    borderColor: active ? `${item.accent}55` : "rgba(255,255,255,.06)",
                    boxShadow: active ? `0 18px 36px rgba(0,0,0,.24), 0 0 0 1px ${item.accent}25 inset` : undefined,
                  }}
                  onClick={() => setSite(item.id)}
                >
                  <div className="lb-site-head">
                    <div className="lb-site-name">{item.name}</div>
                    <span className="lb-site-chip" style={{ color: item.accent }}>
                      {t[item.sourceKey]}
                    </span>
                  </div>
                  <div className="lb-site-meta">
                    <div><strong>{t.siteScope}</strong> {t[item.scopeKey]}</div>
                    <div><strong>{t.siteSpeed}</strong> {t[item.speedKey]}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lb-metrics">
            <div className="lb-metric-card">
              <span className="lb-metric-label">{t.servers}</span>
              <span className="lb-metric-value">{catalog?.servers?.length || 0}</span>
              <span className="lb-subline">{meta.name}</span>
            </div>
            <div className="lb-metric-card">
              <span className="lb-metric-label">{t.types}</span>
              <span className="lb-metric-value">{getSiteTypeCount(site, catalog, detail)}</span>
              <span className="lb-subline">{t[meta.typeKey]}</span>
            </div>
            <div className="lb-metric-card">
              <span className="lb-metric-label">{t.currentRows}</span>
              <span className="lb-metric-value">{rows.length}</span>
              <span className="lb-subline">{t[meta.hintKey]}</span>
            </div>
          </div>
        </section>

        {site === "atlas" ? (
          <AtlasLookupPanel
            t={t}
            locale={locale}
            meta={meta}
            preferredSteamId={preferredSteamId}
          />
        ) : (
        <div className="lb-stack">
          <section className="neon-panel lb-console">
            <div className="lb-console-head">
              <div>
                <div className="lb-console-title">{t.statsConsole}</div>
                <div className="lb-console-copy">{t.statsConsoleCopy}</div>
              </div>

              <div className="lb-console-controls">
                <form onSubmit={runPlayerSearch} className="lb-inline lb-console-search">
                  <label className="lb-field-group" style={{ flex: 1 }}>
                    <span className="lb-field-label">{t.playerLookup}</span>
                    <input
                      className="lb-control"
                      value={playerInput}
                      onChange={(event) => setPlayerInput(event.target.value)}
                      placeholder={t.lookupPlaceholder}
                    />
                  </label>
                  <button className="lb-button primary" style={{ alignSelf: "end" }} type="submit">
                    {playerLoading ? t.loadingPlayer : t.load}
                  </button>
                  {playerLoading ? (
                    <button className="lb-button" style={{ alignSelf: "end" }} type="button" onClick={stopPlayerSearch}>
                      {t.stop}
                    </button>
                  ) : null}
                </form>

                <label className="lb-field-group lb-console-field">
                  <span className="lb-field-label">{t.server}</span>
                  <select key={`server-${site}`} className="lb-control" value={serverId} onChange={(event) => setServerId(event.target.value)}>
                    {(catalog?.servers || []).map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                </label>

                {site === "moose" || site === "survivors" ? (
                  <label className="lb-field-group lb-console-field">
                    <span className="lb-field-label">{t.period}</span>
                    <select className="lb-control" value={period} onChange={(event) => setPeriod(event.target.value)}>
                      {(detail?.periods || []).map((item) => (
                        <option key={item.id || item.name} value={item.id || item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {site === "rustoria" ? (
                  <label className="lb-field-group lb-console-field">
                    <span className="lb-field-label">{t.wipe}</span>
                    <select className="lb-control" value={wipeId} onChange={(event) => setWipeId(event.target.value)}>
                      <option value="">{t.allCurrent}</option>
                      {wipeOptions.map((item) => (
                        <option key={item.key} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {site === "rusticated" ? (
                  <label className="lb-field-group lb-console-field">
                    <span className="lb-field-label">{t.wipe}</span>
                    <select className="lb-control" value={wipeId} onChange={(event) => setWipeId(event.target.value)}>
                      {wipeOptions.map((item) => (
                        <option key={item.key} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>

            <div className="lb-summary-row" style={{ padding: "0 20px 20px" }}>
              <span className="lb-summary-chip">{t.currentSite}: {meta.name}</span>
              <span className="lb-summary-chip">{t.currentServer}: {activeServerName}</span>
              <span className="lb-summary-chip">{t.currentType}: {currentItem?.name || "—"}</span>
              <span className="lb-summary-chip">{t.fields}: {fields.length}</span>
              <span className="lb-summary-chip">Total: {getBoardTotal(site, leaderboard).toLocaleString(locale)}</span>
            </div>

            {catalogLoading ? <div className="lb-status" style={{ margin: "0 20px 20px" }}>{t.loadingCatalog}</div> : null}
            {detailLoading ? <div className="lb-status" style={{ margin: "0 20px 20px" }}>{t.loadingDetail}</div> : null}
            {error ? <div className="lb-error" style={{ margin: "0 20px 20px" }}>{error}</div> : null}
          </section>

          <section className="neon-panel lb-summary-shell">
            <div className="lb-board-top">
              <div className="lb-panel-head" style={{ paddingTop: 18, marginBottom: 0 }}>
                <div>
                  <div className="lb-panel-title">{t.playerTitle}</div>
                  <div className="lb-panel-copy">{t.playerCopy}</div>
                </div>
                <div className="lb-summary-row">
                  <span className="lb-summary-chip">{t.totalMatches}: {getPlayerMatchedCount(site, playerSummary)}</span>
                  <span className="lb-summary-chip">{identityName || "—"}</span>
                  {currentPlayerRow ? <span className="lb-summary-chip">{t.currentType}: {getBucketName(site, currentBucket)}</span> : null}
                </div>
              </div>

              {matchedBuckets.length ? (
                <div className="lb-tag-row">
                  {matchedBuckets.map((bucket) => {
                    const bucketId = getBucketId(site, bucket);
                    const active = bucketId === getBucketId(site, currentBucket);
                    return (
                      <button
                        key={bucketId}
                        className={`lb-tag-button ${active ? "active" : ""}`}
                        onClick={() => selectItem(bucketId)}
                        style={{ color: active ? meta.accent : undefined }}
                      >
                        {getBucketName(site, bucket)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {!playerSummary ? <div className="lb-status" style={{ margin: 18 }}>{t.emptyPlayer}</div> : null}

            {playerSummary && !matchedBuckets.length ? <div className="lb-status" style={{ margin: 18 }}>{t.noMatch}</div> : null}

            {currentPlayerRow ? (
              <div className="lb-summary-body">
                <div className="lb-summary-identity">
                  {rowAvatar(currentPlayerRow) ? (
                    <img className="lb-avatar" src={rowAvatar(currentPlayerRow)} alt="" />
                  ) : (
                    <span className="lb-avatar-fallback">{initialsFromName(rowName(currentPlayerRow))}</span>
                  )}
                  <div>
                    <div className="lb-summary-name">{rowName(currentPlayerRow)}</div>
                    <div className="lb-summary-id">{currentPlayerRow.steamId || currentPlayerRow.rustoriaId || "—"}</div>
                  </div>
                </div>

                <div className="lb-detail-grid">
                  {getBucketFields(site, currentBucket).map((field) => (
                    <div key={`${getBucketId(site, currentBucket)}-${field.id}`} className="lb-detail-item">
                      <span className="lb-detail-label">{field.name}</span>
                      <strong className="lb-detail-value">{formatMetric(fieldValue(currentPlayerRow, field), field, locale)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="neon-panel lb-board-shell">
            <div className="lb-board-top">
              <div className="lb-tag-row">
                {items.map((item) => {
                  const active = item.id === entryId;
                  return (
                    <button
                      key={item.id}
                      className={`lb-tag-button ${active ? "active" : ""}`}
                      onClick={() => selectItem(item.id)}
                      style={{ color: active ? meta.accent : undefined }}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lb-board-toolbar">
              <div className="lb-toolbar secondary">
                <form onSubmit={applyCurrentFilter} className="lb-inline">
                  <label className="lb-field-group" style={{ flex: 1 }}>
                    <span className="lb-field-label">{t.listFilter}</span>
                    <input
                      className="lb-control"
                      value={filterInput}
                      onChange={(event) => setFilterInput(event.target.value)}
                      placeholder={t.filterPlaceholder}
                    />
                  </label>
                  <button className="lb-button" style={{ alignSelf: "end" }} type="submit">
                    {t.apply}
                  </button>
                </form>

                {site === "rusticated" ? (
                  <>
                    <label className="lb-field-group">
                      <span className="lb-field-label">{t.sortBy}</span>
                      <select className="lb-control" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                        {(currentItem?.fields || []).map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="lb-field-group">
                      <span className="lb-field-label">{t.sortDir}</span>
                      <select className="lb-control" value={sortDir} onChange={(event) => setSortDir(event.target.value)}>
                        <option value="desc">{t.desc}</option>
                        <option value="asc">{t.asc}</option>
                      </select>
                    </label>
                  </>
                ) : null}

                {site === "rustoria" ? (
                  <>
                    <label className="lb-field-group">
                      <span className="lb-field-label">{t.sortBy}</span>
                      <select className="lb-control" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                        {(currentItem?.fields || []).map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="lb-field-group">
                      <span className="lb-field-label">{t.orderBy}</span>
                      <select className="lb-control" value={orderBy} onChange={(event) => setOrderBy(event.target.value)}>
                        <option value="desc">{t.desc}</option>
                        <option value="asc">{t.asc}</option>
                      </select>
                    </label>
                  </>
                ) : null}
              </div>
            </div>

            {boardLoading ? <div className="lb-status" style={{ margin: "0 18px 18px" }}>{t.loadingBoard}</div> : null}
            {!boardLoading && rows.length === 0 ? <div className="lb-status" style={{ margin: "0 18px 18px" }}>{t.emptyRows}</div> : null}

            {rows.length ? (
              <>
                <div className="lb-table-wrap" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
                  <table className="lb-table">
                    <thead>
                      <tr>
                        <th>{t.rank}</th>
                        <th>{t.player}</th>
                        {fields.map((field) => (
                          <th key={field.id}>{field.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const active = rowKey(row) === rowKey(compareRow);
                        return (
                          <tr key={`${rowKey(row)}-${row.rank || 0}`} className={`lb-row ${active ? "active" : ""}`}>
                            <td>{row.rank ?? "—"}</td>
                            <td>
                              <button className="lb-row-button" onClick={() => setSelectedCompareKey(rowKey(row))}>
                                <div className="lb-player-cell">
                                  {rowAvatar(row) ? (
                                    <img className="lb-avatar" src={rowAvatar(row)} alt="" />
                                  ) : (
                                    <span className="lb-avatar-fallback">{initialsFromName(rowName(row))}</span>
                                  )}
                                  <div>
                                    <div>{rowName(row)}</div>
                                    <span className="lb-note">{row.steamId || row.rustoriaId || row.playerUrl || "—"}</span>
                                  </div>
                                </div>
                              </button>
                            </td>
                            {fields.map((field) => (
                              <td key={field.id}>{formatMetric(fieldValue(row, field), field, locale)}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="lb-pagination" style={{ padding: "14px 18px 18px" }}>
                  <button
                    className="lb-button"
                    disabled={!pageInfo.hasPrev}
                    onClick={() => {
                      if (site === "moose" || site === "survivors") setPage((current) => Math.max(1, current - 1));
                      else setOffset((current) => Math.max(0, current - PAGE_SIZE));
                    }}
                  >
                    {t.previous}
                  </button>
                  <span className="lb-summary-chip">
                    {t.page} {pageInfo.current}
                    {pageInfo.totalPages ? ` / ${pageInfo.totalPages}` : ""}
                  </span>
                  <button
                    className="lb-button"
                    disabled={!pageInfo.hasNext}
                    onClick={() => {
                      if (site === "moose" || site === "survivors") setPage((current) => current + 1);
                      else setOffset((current) => current + PAGE_SIZE);
                    }}
                  >
                    {t.next}
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </div>
        )}
      </div>
    </>
  );
}
