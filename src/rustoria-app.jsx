import React, { startTransition, useDeferredValue, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const RUSTORIA_API = `${API_BASE}/rustoria`;
const PAGE_SIZE = 10;

const styles = `
:root {
  color-scheme: dark;
  --bg: #0a1016;
  --panel: rgba(10, 17, 24, 0.84);
  --panel-strong: rgba(15, 25, 35, 0.96);
  --panel-soft: rgba(13, 21, 30, 0.72);
  --line: rgba(152, 193, 217, 0.16);
  --line-strong: rgba(152, 193, 217, 0.28);
  --text: #edf6f9;
  --muted: #8fa7b5;
  --accent: #7dd3c7;
  --accent-strong: #19b4a6;
  --accent-warm: #f4b66a;
  --danger: #ff8a80;
  --shadow: 0 28px 80px rgba(0, 0, 0, 0.35);
  font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  background:
    radial-gradient(circle at top left, rgba(25, 180, 166, 0.16), transparent 28%),
    radial-gradient(circle at top right, rgba(244, 182, 106, 0.18), transparent 24%),
    linear-gradient(180deg, #081018 0%, #0a1016 48%, #071017 100%);
  color: var(--text);
}

a {
  color: inherit;
}

button,
input,
select {
  font: inherit;
}

.app-shell {
  width: min(1480px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 28px 0 40px;
}

.hero {
  display: grid;
  grid-template-columns: 1.35fr 0.95fr;
  gap: 18px;
  margin-bottom: 18px;
}

.hero-card,
.panel {
  border: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(18px);
  border-radius: 28px;
  box-shadow: var(--shadow);
}

.hero-card {
  min-height: 220px;
  padding: 26px 28px;
}

.kicker {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(125, 211, 199, 0.25);
  background: rgba(125, 211, 199, 0.08);
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 11px;
  margin-bottom: 18px;
}

.hero-title {
  margin: 0;
  font-size: clamp(32px, 5vw, 56px);
  line-height: 0.96;
  letter-spacing: -0.04em;
  font-weight: 700;
  max-width: 12ch;
}

.hero-copy {
  margin: 16px 0 0;
  max-width: 56ch;
  color: var(--muted);
  line-height: 1.65;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 26px;
}

.metric-card {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.metric-label {
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.metric-value {
  display: block;
  margin-top: 10px;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.metric-subvalue {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
}

.layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 18px;
}

.sidebar,
.content {
  display: grid;
  gap: 18px;
}

.panel {
  padding: 20px;
}

.panel h2,
.panel h3,
.panel h4 {
  margin: 0;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.panel-title {
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.panel-copy {
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
}

.field-group {
  display: grid;
  gap: 10px;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
}

.control,
.button,
.chip {
  border-radius: 16px;
  border: 1px solid var(--line);
  transition: 160ms ease;
}

.control {
  width: 100%;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
}

.control:focus,
.button:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(125, 211, 199, 0.12);
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(125, 211, 199, 0.22), rgba(25, 180, 166, 0.18));
  color: var(--text);
  cursor: pointer;
}

.button:hover {
  border-color: var(--line-strong);
  transform: translateY(-1px);
}

.button.secondary {
  background: rgba(255, 255, 255, 0.04);
}

.button.ghost {
  background: transparent;
}

.button.active {
  border-color: rgba(244, 182, 106, 0.45);
  background: linear-gradient(135deg, rgba(244, 182, 106, 0.2), rgba(244, 182, 106, 0.08));
}

.server-grid,
.stat-grid,
.lookup-grid,
.compare-grid,
.fields-grid,
.leaderboard-summary {
  display: grid;
  gap: 12px;
}

.server-grid {
  grid-template-columns: repeat(auto-fill, minmax(142px, 1fr));
}

.server-card {
  position: relative;
  overflow: hidden;
  text-align: left;
  padding: 14px;
  background: rgba(255, 255, 255, 0.03);
}

.server-card img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.server-card-title {
  display: block;
  font-size: 14px;
  font-weight: 620;
}

.server-card-meta {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 12px;
}

.stat-grid {
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
}

.chip {
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  text-align: left;
}

.chip small,
.lookup-card small {
  display: block;
  margin-top: 5px;
  color: var(--muted);
}

.fields-grid {
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}

.field-chip {
  padding: 12px 13px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
}

.field-chip img {
  width: 20px;
  height: 20px;
  object-fit: contain;
  margin-right: 8px;
  vertical-align: middle;
}

.field-chip strong {
  display: block;
  font-size: 13px;
}

.field-chip span {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}

.toolbar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.leaderboard-summary {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 16px;
}

.summary-card {
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.summary-card strong {
  display: block;
  font-size: 22px;
  margin-top: 10px;
}

.lookup-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.lookup-card {
  padding: 16px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.03);
}

.lookup-card header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.lookup-match {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(125, 211, 199, 0.2);
  background: rgba(125, 211, 199, 0.08);
  color: var(--accent);
  font-size: 12px;
}

.lookup-total {
  display: block;
  margin-top: 12px;
  font-size: 26px;
  font-weight: 700;
}

.lookup-fields {
  margin-top: 14px;
  display: grid;
  gap: 8px;
}

.lookup-field {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
  font-size: 13px;
}

.lookup-field strong {
  color: var(--text);
  font-weight: 600;
}

.table-wrap {
  overflow: auto;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 920px;
}

th,
td {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  text-align: left;
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  background: rgba(10, 17, 24, 0.94);
  backdrop-filter: blur(14px);
  z-index: 1;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

tbody tr:hover {
  background: rgba(255, 255, 255, 0.03);
}

.table-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.table-user img,
.table-user-fallback {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(125, 211, 199, 0.14);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-weight: 700;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}

.pagination-copy {
  color: var(--muted);
  font-size: 13px;
}

.compare-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.compare-card {
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.compare-card header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.compare-name {
  display: flex;
  align-items: center;
  gap: 10px;
}

.compare-total {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(244, 182, 106, 0.08);
  border: 1px solid rgba(244, 182, 106, 0.18);
  color: var(--accent-warm);
  font-size: 12px;
}

.compare-field {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.compare-field span {
  color: var(--muted);
  font-size: 13px;
}

.compare-field strong {
  font-size: 14px;
}

.delta-positive {
  color: var(--accent);
}

.delta-negative {
  color: var(--danger);
}

.status {
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(244, 182, 106, 0.18);
  background: rgba(244, 182, 106, 0.08);
  color: #ffd6a5;
}

.status.error {
  border-color: rgba(255, 138, 128, 0.24);
  background: rgba(255, 138, 128, 0.08);
  color: #ffb4ab;
}

.split-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 1120px) {
  .hero,
  .layout {
    grid-template-columns: 1fr;
  }

  .toolbar,
  .leaderboard-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .app-shell {
    width: min(100vw - 20px, 1480px);
    padding-top: 16px;
  }

  .hero-card,
  .panel {
    padding: 18px;
    border-radius: 22px;
  }

  .hero-metrics,
  .toolbar,
  .leaderboard-summary {
    grid-template-columns: 1fr;
  }

  .server-grid,
  .stat-grid,
  .lookup-grid,
  .compare-grid,
  .fields-grid {
    grid-template-columns: 1fr;
  }
}
`;

function buildUrl(path, params = {}) {
  const url = new URL(`${RUSTORIA_API}${path}`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}`;
}

async function fetchJson(path, params) {
  const response = await fetch(buildUrl(path, params));
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `请求失败 (${response.status})`);
  }
  return payload;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric.toLocaleString("en-US", {
      maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    });
  }
  return String(value);
}

function formatDuration(secondsValue) {
  const seconds = Number(secondsValue);
  if (!Number.isFinite(seconds)) return "—";
  const hours = seconds / 3600;
  if (hours >= 1) {
    return `${hours.toLocaleString("en-US", { maximumFractionDigits: hours >= 10 ? 1 : 2 })}h`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes}m`;
}

function formatMetric(value, field) {
  if (value === null || value === undefined || value === "") return "—";
  if (field?.kind === "duration") return formatDuration(value);
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    if (field?.kind === "percent") return `${numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
    if (field?.kind === "ratio") return numeric.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return numeric.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2 });
  }
  return String(value);
}

function initialsFromName(value) {
  return String(value || "?").slice(0, 2).toUpperCase();
}

function fieldValue(row, field) {
  if (!row) return null;
  if (field.id === "total") return row.total;
  return row.data?.[field.id] ?? null;
}

function deltaText(left, right, field) {
  const leftNum = Number(left);
  const rightNum = Number(right);
  if (!Number.isFinite(leftNum) || !Number.isFinite(rightNum)) return "—";
  const delta = leftNum - rightNum;
  if (delta === 0) return "0";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatMetric(delta, field)}`;
}

export default function RustoriaApp() {
  const [servers, setServers] = useState([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [selectedServerId, setSelectedServerId] = useState("");
  const [serverDetail, setServerDetail] = useState(null);
  const [wipes, setWipes] = useState([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [selectedStatId, setSelectedStatId] = useState("");
  const [selectedWipe, setSelectedWipe] = useState("");
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState("");
  const [orderBy, setOrderBy] = useState("desc");
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState(null);
  const [playerInput, setPlayerInput] = useState("");
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerSummary, setPlayerSummary] = useState(null);
  const [selectedCompareId, setSelectedCompareId] = useState("");
  const deferredPlayerInput = useDeferredValue(playerInput.trim());

  useEffect(() => {
    let alive = true;
    setServersLoading(true);
    fetchJson("/servers", { leaderboardOnly: 1 })
      .then((payload) => {
        if (!alive) return;
        setServers(payload.servers || []);
        if (!selectedServerId && payload.servers?.length) {
          setSelectedServerId(payload.servers[0].id);
        }
      })
      .catch((error) => {
        if (alive) setPageError(error.message);
      })
      .finally(() => {
        if (alive) setServersLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedServerId) return;
    let alive = true;
    setServerLoading(true);
    Promise.all([
      fetchJson(`/servers/${encodeURIComponent(selectedServerId)}`),
      fetchJson(`/servers/${encodeURIComponent(selectedServerId)}/wipes`),
    ])
      .then(([serverPayload, wipePayload]) => {
        if (!alive) return;
        const nextServer = serverPayload.server;
        setServerDetail(nextServer);
        setWipes(wipePayload.wipes || []);
        startTransition(() => {
          const nextStatistic = nextServer.statistics?.find((item) => item.id === selectedStatId) || nextServer.statistics?.[0] || null;
          setSelectedStatId(nextStatistic?.id || "");
          setSortBy(nextStatistic?.defaultSort || "");
          setOrderBy("desc");
          setSelectedWipe("");
          setOffset(0);
          setPlayerSummary(null);
          setSelectedCompareId("");
        });
      })
      .catch((error) => {
        if (alive) {
          setServerDetail(null);
          setWipes([]);
          setPageError(error.message);
        }
      })
      .finally(() => {
        if (alive) setServerLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedServerId]);

  useEffect(() => {
    if (!serverDetail || !selectedStatId) return;
    const statistic = serverDetail.statistics?.find((item) => item.id === selectedStatId);
    if (!statistic) return;
    let alive = true;
    setLeaderboardLoading(true);
    fetchJson(`/servers/${encodeURIComponent(selectedServerId)}/leaderboards/${encodeURIComponent(selectedStatId)}`, {
      from: offset,
      sortBy: sortBy || statistic.defaultSort,
      orderBy,
      wipe: selectedWipe,
    })
      .then((payload) => {
        if (!alive) return;
        setLeaderboard(payload);
        const nextCompareId = payload.rows?.[0]?.rustoriaId || "";
        setSelectedCompareId((current) => {
          if (!current) return nextCompareId;
          return payload.rows?.some((row) => row.rustoriaId === current) ? current : nextCompareId;
        });
      })
      .catch((error) => {
        if (alive) {
          setLeaderboard(null);
          setPageError(error.message);
        }
      })
      .finally(() => {
        if (alive) setLeaderboardLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedServerId, selectedStatId, selectedWipe, offset, sortBy, orderBy, serverDetail]);

  const currentStatistic = serverDetail?.statistics?.find((item) => item.id === selectedStatId) || null;
  const currentFields = leaderboard?.fields || currentStatistic?.fields || [];
  const currentRows = leaderboard?.rows || [];
  const currentPlayerStat = playerSummary?.statistics?.find((item) => item.statistic.id === selectedStatId) || null;
  const playerRow = currentPlayerStat?.selectedMatch || null;
  const compareRow = currentRows.find((row) => row.rustoriaId === selectedCompareId) || currentRows[0] || null;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = leaderboard?.totalItems ? Math.max(1, Math.ceil(leaderboard.totalItems / PAGE_SIZE)) : 1;

  async function runPlayerSearch(event) {
    event?.preventDefault();
    if (!selectedServerId || !playerInput.trim()) return;
    setPlayerLoading(true);
    setPageError("");
    try {
      const payload = await fetchJson("/player-search", {
        serverId: selectedServerId,
        username: playerInput.trim(),
        wipe: selectedWipe,
      });
      setPlayerSummary(payload);
    } catch (error) {
      setPlayerSummary(null);
      setPageError(error.message);
    } finally {
      setPlayerLoading(false);
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="app-shell">
        <section className="hero">
          <div className="hero-card">
            <div className="kicker">Rustoria Live Data</div>
            <h1 className="hero-title">Rustoria 排行榜本地查询台</h1>
            <p className="hero-copy">
              从 Rustoria 实时拉取服务器、统计类型、字段结构、排行榜和玩家搜索结果。
              你可以先选服务器，再按 PVP / PVP+ / PVE 等类型查看字段，最后输入玩家名称做跨类型聚合和同类对比。
            </p>
            <div className="hero-metrics">
              <div className="metric-card">
                <span className="metric-label">Leaderboard Servers</span>
                <span className="metric-value">{servers.length}</span>
                <span className="metric-subvalue">来自 `api.rustoria.co/servers`</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Statistic Types</span>
                <span className="metric-value">{serverDetail?.statistics?.length || 0}</span>
                <span className="metric-subvalue">当前服务器可查询类型</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Current Query</span>
                <span className="metric-value">{leaderboard?.totalItems ?? 0}</span>
                <span className="metric-subvalue">当前类型匹配玩家数</span>
              </div>
            </div>
          </div>
          <div className="hero-card">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">实时链路</h2>
                <div className="panel-copy">服务器列表 → 类型明细 → 分页榜单 → 玩家跨类型聚合 → 当前类型对比</div>
              </div>
            </div>
            <div className="leaderboard-summary">
              <div className="summary-card">
                <span className="metric-label">Server</span>
                <strong>{serverDetail?.name || "—"}</strong>
              </div>
              <div className="summary-card">
                <span className="metric-label">Statistic</span>
                <strong>{currentStatistic?.name || "—"}</strong>
              </div>
              <div className="summary-card">
                <span className="metric-label">Fields</span>
                <strong>{currentFields.length}</strong>
              </div>
              <div className="summary-card">
                <span className="metric-label">Wipes</span>
                <strong>{wipes.length}</strong>
              </div>
            </div>
            {pageError ? <div className="status error">{pageError}</div> : null}
            {!pageError ? (
              <div className="status">
                真实测试建议玩家名: <strong>`cactus`</strong>，当前服务器: <strong>{selectedServerId || "未选择"}</strong>
              </div>
            ) : null}
          </div>
        </section>

        <div className="layout">
          <aside className="sidebar">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">服务器</h3>
                  <div className="panel-copy">只展示 Rustoria 已开放 leaderboard 的服务器。</div>
                </div>
              </div>
              {serversLoading ? <div className="status">正在加载服务器...</div> : null}
              <div className="server-grid">
                {servers.map((server) => (
                  <button
                    key={server.id}
                    className={`server-card button ${server.id === selectedServerId ? "active" : "secondary"}`}
                    onClick={() => startTransition(() => setSelectedServerId(server.id))}
                  >
                    <img src={server.image} alt={server.name} />
                    <span className="server-card-title">{server.name}</span>
                    <span className="server-card-meta">
                      {server.region?.toUpperCase() || "N/A"} · {server.serverType || "mixed"}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">类型与字段</h3>
                  <div className="panel-copy">类型来自 `servers/find/{'{serverId}'}`，字段来自 composition 与 mappings。</div>
                </div>
              </div>
              {serverLoading ? <div className="status">正在加载当前服务器详情...</div> : null}
              <div className="stat-grid">
                {(serverDetail?.statistics || []).map((statistic) => (
                  <button
                    key={statistic.id}
                    className={`chip ${statistic.id === selectedStatId ? "active" : ""}`}
                    onClick={() => {
                      startTransition(() => {
                        setSelectedStatId(statistic.id);
                        setSortBy(statistic.defaultSort || "");
                        setOrderBy("desc");
                        setOffset(0);
                      });
                    }}
                  >
                    <strong>{statistic.name}</strong>
                    <small>{statistic.id}</small>
                  </button>
                ))}
              </div>
              <div style={{ height: 16 }} />
              <div className="fields-grid">
                {currentStatistic?.fields?.map((field) => (
                  <div key={field.id} className="field-chip">
                    <strong>
                      {field.image ? <img src={field.image} alt={field.name} /> : null}
                      {field.name}
                    </strong>
                    <span>{field.id}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <main className="content">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">排行榜浏览</h3>
                  <div className="panel-copy">
                    当前接口: <code>/statistics/leaderboards/{selectedServerId || "{server}"}/{selectedStatId || "{stat}"}</code>
                  </div>
                </div>
              </div>
              <div className="toolbar">
                <label className="field-group">
                  <span className="field-label">Wipe</span>
                  <select className="control" value={selectedWipe} onChange={(event) => {
                    setSelectedWipe(event.target.value);
                    setOffset(0);
                  }}>
                    <option value="">Current Wipe</option>
                    {wipes.map((wipe) => (
                      <option key={wipe} value={wipe}>{wipe}</option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span className="field-label">Sort By</span>
                  <select className="control" value={sortBy} onChange={(event) => {
                    setSortBy(event.target.value);
                    setOffset(0);
                  }}>
                    {currentFields.map((field) => (
                      <option key={field.id} value={field.id}>{field.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span className="field-label">Order</span>
                  <select className="control" value={orderBy} onChange={(event) => {
                    setOrderBy(event.target.value);
                    setOffset(0);
                  }}>
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </label>
                <div className="field-group">
                  <span className="field-label">状态</span>
                  <div className="status">{leaderboardLoading ? "正在拉取最新榜单..." : "榜单已同步"}</div>
                </div>
              </div>

              <div className="leaderboard-summary">
                <div className="summary-card">
                  <span className="metric-label">Total Players</span>
                  <strong>{leaderboard?.totalItems ?? 0}</strong>
                </div>
                <div className="summary-card">
                  <span className="metric-label">Overall Total</span>
                  <strong>{formatNumber(leaderboard?.totals?.total)}</strong>
                </div>
                <div className="summary-card">
                  <span className="metric-label">Default Sort</span>
                  <strong>{currentStatistic?.defaultSort || "—"}</strong>
                </div>
                <div className="summary-card">
                  <span className="metric-label">Display Mode</span>
                  <strong>{currentStatistic?.display || "name"}</strong>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>Total</th>
                      {currentFields.map((field) => (
                        <th key={field.id}>{field.name}</th>
                      ))}
                      <th>Compare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row) => (
                      <tr key={`${row.rustoriaId}-${row.rank}`}>
                        <td>{row.rank}</td>
                        <td>
                          <div className="table-user">
                            {row.avatar ? (
                              <img src={row.avatar} alt={row.username} />
                            ) : (
                              <span className="table-user-fallback">{initialsFromName(row.username)}</span>
                            )}
                            <div>
                              <div>{row.username}</div>
                              <small style={{ color: "var(--muted)" }}>{row.rustoriaId}</small>
                            </div>
                          </div>
                        </td>
                        <td>{formatNumber(row.total)}</td>
                        {currentFields.map((field) => (
                          <td key={`${row.rustoriaId}-${field.id}`}>{formatMetric(fieldValue(row, field), field)}</td>
                        ))}
                        <td>
                          <button
                            className={`button ${selectedCompareId === row.rustoriaId ? "active" : "secondary"}`}
                            onClick={() => setSelectedCompareId(row.rustoriaId)}
                          >
                            对比
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!currentRows.length ? (
                      <tr>
                        <td colSpan={4 + currentFields.length}>当前条件下没有返回数据。</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-copy">
                  第 {currentPage} / {totalPages} 页，已载入 {currentRows.length} 条记录
                </div>
                <div className="split-actions">
                  <button className="button secondary" disabled={offset <= 0} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}>
                    上一页
                  </button>
                  <button
                    className="button secondary"
                    disabled={offset + PAGE_SIZE >= (leaderboard?.totalItems || 0)}
                    onClick={() => setOffset((value) => value + PAGE_SIZE)}
                  >
                    下一页
                  </button>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">玩家聚合查询</h3>
                  <div className="panel-copy">
                    一次性遍历当前服务器全部统计类型，用真实用户名做跨类型匹配和汇总。
                  </div>
                </div>
              </div>
              <form className="toolbar" onSubmit={runPlayerSearch}>
                <label className="field-group" style={{ gridColumn: "span 2" }}>
                  <span className="field-label">Player Name</span>
                  <input
                    className="control"
                    placeholder="例如 cactus"
                    value={playerInput}
                    onChange={(event) => setPlayerInput(event.target.value)}
                  />
                </label>
                <div className="field-group">
                  <span className="field-label">Matched Types</span>
                  <div className="status">{playerSummary?.matchedStatistics ?? 0}</div>
                </div>
                <div className="field-group">
                  <span className="field-label">Action</span>
                  <button className="button" type="submit" disabled={playerLoading || !playerInput.trim()}>
                    {playerLoading ? "查询中..." : "查询玩家"}
                  </button>
                </div>
              </form>

              {playerSummary ? (
                <div className="status">
                  玩家 <strong>{playerSummary.identity?.username || deferredPlayerInput}</strong> 在当前服务器命中了{" "}
                  <strong>{playerSummary.matchedStatistics}</strong> 个统计类型。
                </div>
              ) : null}

              <div style={{ height: 16 }} />
              <div className="lookup-grid">
                {(playerSummary?.statistics || []).map((item) => (
                  <article key={item.statistic.id} className="lookup-card">
                    <header>
                      <div>
                        <strong>{item.statistic.name}</strong>
                        <small>{item.statistic.id}</small>
                      </div>
                      <span className="lookup-match">
                        {item.exactMatchCount ? "Exact" : item.matchCount ? "Partial" : "No Match"}
                      </span>
                    </header>
                    <span className="lookup-total">{formatNumber(item.selectedMatch?.total)}</span>
                    <small>{item.selectedMatch?.username || "未命中玩家"}</small>
                    <div className="lookup-fields">
                      {item.statistic.fields.slice(0, 4).map((field) => (
                        <div key={field.id} className="lookup-field">
                          <span>{field.name}</span>
                          <strong>{formatMetric(fieldValue(item.selectedMatch, field), field)}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">当前类型对比</h3>
                  <div className="panel-copy">
                    左侧为查询玩家，右侧为你在排行榜中选中的参照行。用于核对当前类型下每个字段的真实差值。
                  </div>
                </div>
              </div>

              {playerRow && compareRow ? (
                <div className="compare-grid">
                  <article className="compare-card">
                    <header>
                      <div className="compare-name">
                        {playerRow.avatar ? (
                          <img className="table-user-fallback" src={playerRow.avatar} alt={playerRow.username} />
                        ) : (
                          <span className="table-user-fallback">{initialsFromName(playerRow.username)}</span>
                        )}
                        <div>
                          <strong>{playerRow.username}</strong>
                          <small style={{ color: "var(--muted)" }}>查询结果</small>
                        </div>
                      </div>
                      <span className="compare-total">Total {formatNumber(playerRow.total)}</span>
                    </header>
                    {currentFields.map((field) => (
                      <div key={field.id} className="compare-field">
                        <span>{field.name}</span>
                        <strong>{formatMetric(fieldValue(playerRow, field), field)}</strong>
                        <span className={Number(fieldValue(playerRow, field)) - Number(fieldValue(compareRow, field)) >= 0 ? "delta-positive" : "delta-negative"}>
                          {deltaText(fieldValue(playerRow, field), fieldValue(compareRow, field), field)}
                        </span>
                      </div>
                    ))}
                  </article>

                  <article className="compare-card">
                    <header>
                      <div className="compare-name">
                        {compareRow.avatar ? (
                          <img className="table-user-fallback" src={compareRow.avatar} alt={compareRow.username} />
                        ) : (
                          <span className="table-user-fallback">{initialsFromName(compareRow.username)}</span>
                        )}
                        <div>
                          <strong>{compareRow.username}</strong>
                          <small style={{ color: "var(--muted)" }}>排行榜参照</small>
                        </div>
                      </div>
                      <span className="compare-total">Total {formatNumber(compareRow.total)}</span>
                    </header>
                    {currentFields.map((field) => (
                      <div key={field.id} className="compare-field">
                        <span>{field.name}</span>
                        <strong>{formatMetric(fieldValue(compareRow, field), field)}</strong>
                        <span style={{ color: "var(--muted)" }}>{field.id}</span>
                      </div>
                    ))}
                  </article>
                </div>
              ) : (
                <div className="status">
                  先输入玩家名称执行聚合查询，再从上面的排行榜中选一条记录做当前类型对比。
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
