import React, { startTransition, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const RUSTICATED_API = `${API_BASE}/rusticated`;
const PAGE_SIZE = 10;

const styles = `
:root {
  color-scheme: dark;
  --bg: #120d09;
  --panel: rgba(23, 16, 11, 0.86);
  --line: rgba(251, 191, 36, 0.16);
  --line-strong: rgba(251, 191, 36, 0.3);
  --text: #fff7ed;
  --muted: #c4b5a5;
  --accent: #fbbf24;
  --accent-strong: #f59e0b;
  --accent-cool: #fb7185;
  --danger: #fda4af;
  --shadow: 0 28px 80px rgba(0, 0, 0, 0.34);
  font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  background:
    radial-gradient(circle at top left, rgba(251, 191, 36, 0.18), transparent 30%),
    radial-gradient(circle at top right, rgba(251, 113, 133, 0.14), transparent 22%),
    linear-gradient(180deg, #120d09 0%, #17100b 52%, #110c08 100%);
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
  grid-template-columns: 1.28fr 0.92fr;
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
  border: 1px solid rgba(251, 191, 36, 0.28);
  background: rgba(251, 191, 36, 0.08);
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
  max-width: 62ch;
  color: var(--muted);
  line-height: 1.65;
}

.hero-metrics,
.summary-grid,
.server-grid,
.group-grid,
.fields-grid,
.lookup-grid,
.compare-grid {
  display: grid;
  gap: 12px;
}

.hero-metrics,
.summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 24px;
}

.server-grid {
  grid-template-columns: repeat(auto-fill, minmax(146px, 1fr));
}

.group-grid {
  grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
}

.fields-grid,
.lookup-grid,
.compare-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.metric-card,
.summary-card,
.field-chip,
.lookup-card,
.compare-card {
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

.metric-value,
.summary-card strong {
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

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.panel-title {
  margin: 0;
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

.button,
.server-card,
.chip,
.control {
  border-radius: 16px;
  border: 1px solid var(--line);
  transition: 160ms ease;
}

.button,
.server-card,
.chip {
  cursor: pointer;
}

.button,
.server-card {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.18), rgba(245, 158, 11, 0.12));
  color: var(--text);
}

.button.secondary,
.server-card.secondary,
.chip {
  background: rgba(255, 255, 255, 0.04);
}

.button.active,
.server-card.active,
.chip.active {
  border-color: rgba(251, 113, 133, 0.44);
  background: linear-gradient(135deg, rgba(251, 113, 133, 0.2), rgba(251, 113, 133, 0.06));
}

.button:hover,
.server-card:hover,
.chip:hover {
  border-color: var(--line-strong);
  transform: translateY(-1px);
}

.server-card {
  width: 100%;
  text-align: left;
  justify-content: flex-start;
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

.chip {
  padding: 12px 14px;
  text-align: left;
}

.chip small,
.field-chip span {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 12px;
}

.field-chip strong {
  display: block;
  font-size: 13px;
}

.toolbar,
.toolbar-inline,
.split-actions,
.pagination {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.toolbar {
  margin-bottom: 16px;
}

.field-group {
  display: grid;
  gap: 8px;
  min-width: 180px;
}

.field-label {
  display: block;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
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
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.12);
}

.status {
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(251, 191, 36, 0.18);
  background: rgba(251, 191, 36, 0.08);
  color: #fde68a;
}

.status.error {
  border-color: rgba(251, 113, 133, 0.24);
  background: rgba(251, 113, 133, 0.08);
  color: #fecdd3;
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
  background: rgba(18, 13, 9, 0.96);
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
  background: rgba(251, 191, 36, 0.14);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-weight: 700;
}

.pagination {
  justify-content: space-between;
  margin-top: 14px;
}

.pagination-copy {
  color: var(--muted);
  font-size: 13px;
}

.lookup-card header,
.compare-card header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.lookup-match,
.compare-total {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 999px;
  font-size: 12px;
}

.lookup-match {
  border: 1px solid rgba(251, 191, 36, 0.2);
  background: rgba(251, 191, 36, 0.08);
  color: var(--accent);
}

.compare-total {
  border: 1px solid rgba(251, 113, 133, 0.18);
  background: rgba(251, 113, 133, 0.08);
  color: var(--accent-cool);
}

.lookup-fields,
.compare-fields {
  margin-top: 14px;
  display: grid;
  gap: 8px;
}

.lookup-field,
.compare-field {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  color: var(--muted);
  font-size: 13px;
}

.lookup-field strong,
.compare-field strong {
  color: var(--text);
  font-weight: 600;
}

.delta-positive {
  color: var(--accent);
}

.delta-negative {
  color: var(--danger);
}

@media (max-width: 1120px) {
  .hero,
  .layout {
    grid-template-columns: 1fr;
  }

  .hero-metrics,
  .summary-grid {
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
  .summary-grid,
  .server-grid,
  .group-grid,
  .fields-grid,
  .lookup-grid,
  .compare-grid {
    grid-template-columns: 1fr;
  }
}
`;

function buildUrl(path, params = {}) {
  const url = new URL(`${RUSTICATED_API}${path}`, window.location.origin);
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

function initialsFromName(value) {
  return String(value || "?").slice(0, 2).toUpperCase();
}

function rowKey(row) {
  return row?.steamId || row?.clanName || row?.username || "";
}

function formatDuration(secondsValue) {
  const total = Number(secondsValue);
  if (!Number.isFinite(total)) return "—";
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = Math.floor(total % 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || !parts.length) parts.push(`${seconds}s`);
  return parts.join(" ");
}

function formatMetric(value, field) {
  if (value === null || value === undefined || value === "") return "—";
  if (field?.kind === "duration") return formatDuration(value);
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (field?.kind === "ratio") {
      return numeric.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return numeric.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2 });
  }
  return String(value);
}

function getFieldValue(row, field) {
  return row?.stats?.[field.id];
}

function numericValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function deltaText(left, right, field) {
  const leftNum = numericValue(left);
  const rightNum = numericValue(right);
  if (leftNum === null || rightNum === null) return "—";
  const delta = leftNum - rightNum;
  if (delta === 0) return "0";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatMetric(delta, field)}`;
}

function summarizeFields(row, fields, limit = 5) {
  if (!row) return [];
  return fields
    .map((field) => ({ field, value: getFieldValue(row, field) }))
    .filter((item) => item.value !== null && item.value !== undefined && item.value !== "")
    .slice(0, limit);
}

export default function RusticatedApp() {
  const [catalog, setCatalog] = useState({ servers: [], groups: [] });
  const [selectedServerId, setSelectedServerId] = useState("");
  const [serverDetail, setServerDetail] = useState(null);
  const [selectedWipeId, setSelectedWipeId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedSortBy, setSelectedSortBy] = useState("");
  const [sortDir, setSortDir] = useState("desc");
  const [offset, setOffset] = useState(0);
  const [filterInput, setFilterInput] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [leaderboard, setLeaderboard] = useState(null);
  const [playerInput, setPlayerInput] = useState("");
  const [playerSummary, setPlayerSummary] = useState(null);
  const [selectedCompareKey, setSelectedCompareKey] = useState("");
  const [pageError, setPageError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [serverLoading, setServerLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setCatalogLoading(true);
    fetchJson("/servers")
      .then((payload) => {
        if (!alive) return;
        setCatalog({
          servers: payload.servers || [],
          groups: payload.groups || [],
        });
        if (payload.servers?.length && !selectedServerId) {
          setSelectedServerId(payload.servers[0].id);
        }
        if (payload.groups?.length && !selectedGroupId) {
          setSelectedGroupId(payload.groups[0].id);
        }
      })
      .catch((error) => {
        if (alive) setPageError(error.message);
      })
      .finally(() => {
        if (alive) setCatalogLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedServerId) return;
    let alive = true;
    setServerLoading(true);
    fetchJson(`/servers/${encodeURIComponent(selectedServerId)}`)
      .then((payload) => {
        if (!alive) return;
        setServerDetail(payload);
        startTransition(() => {
          const nextGroup = (payload.groups || []).find((item) => item.id === selectedGroupId) || payload.groups?.[0] || null;
          setSelectedGroupId(nextGroup?.id || "");
          setSelectedSortBy(nextGroup?.defaultSort || "");
          setSelectedWipeId(payload.defaultWipeId ? String(payload.defaultWipeId) : "");
          setSortDir("desc");
          setOffset(0);
          setSelectedCompareKey("");
        });
      })
      .catch((error) => {
        if (alive) {
          setServerDetail(null);
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
    if (!selectedServerId || !selectedGroupId) return;
    let alive = true;
    setLeaderboardLoading(true);
    fetchJson(`/servers/${encodeURIComponent(selectedServerId)}/leaderboards/${encodeURIComponent(selectedGroupId)}`, {
      wipeId: selectedWipeId,
      sortBy: selectedSortBy,
      sortDir,
      filter: filterValue,
      offset,
      limit: PAGE_SIZE,
      type: "player",
    })
      .then((payload) => {
        if (!alive) return;
        setLeaderboard(payload);
        const nextCompareKey = rowKey(payload.rows?.[0]);
        setSelectedCompareKey((current) => {
          if (!current) return nextCompareKey;
          return payload.rows?.some((row) => rowKey(row) === current) ? current : nextCompareKey;
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
  }, [selectedServerId, selectedWipeId, selectedGroupId, selectedSortBy, sortDir, filterValue, offset]);

  const currentGroup = (serverDetail?.groups || catalog.groups).find((item) => item.id === selectedGroupId) || null;
  const currentFields = leaderboard?.fields || currentGroup?.fields || [];
  const currentRows = leaderboard?.rows || [];
  const compareRow = currentRows.find((row) => rowKey(row) === selectedCompareKey) || currentRows[0] || null;
  const currentPlayerGroup = playerSummary?.groups?.find((item) => item.group.id === selectedGroupId) || null;
  const playerRow = currentPlayerGroup?.selectedMatch || null;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = leaderboard?.total ? Math.max(1, Math.ceil(leaderboard.total / PAGE_SIZE)) : 1;

  async function submitFilter(event) {
    event.preventDefault();
    startTransition(() => {
      setFilterValue(filterInput.trim());
      setOffset(0);
    });
  }

  async function runPlayerSearch(event) {
    event?.preventDefault();
    if (!selectedServerId || !playerInput.trim()) return;
    setPlayerLoading(true);
    setPageError("");
    try {
      const payload = await fetchJson("/player-search", {
        serverId: selectedServerId,
        wipeId: selectedWipeId,
        username: playerInput.trim(),
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
            <div className="kicker">Rusticated API</div>
            <h1 className="hero-title">Rusticated 排行榜查询台</h1>
            <p className="hero-copy">
              直接接入 Rusticated 公开 leaderboard API，支持服务器、wipe、统计组、组内字段、分页榜单和玩家跨组查询。
              这套站点不依赖浏览器抓取，查询速度会明显快于 Moose。
            </p>
            <div className="hero-metrics">
              <div className="metric-card">
                <span className="metric-label">Servers</span>
                <span className="metric-value">{catalog.servers.length}</span>
                <span className="metric-subvalue">来自 `api/v2/servers?orgId=1`</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Groups</span>
                <span className="metric-value">{catalog.groups.length}</span>
                <span className="metric-subvalue">全部 leaderboard 统计组</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Current Total</span>
                <span className="metric-value">{leaderboard?.total ?? 0}</span>
                <span className="metric-subvalue">当前条件下的总记录数</span>
              </div>
            </div>
          </div>

          <div className="hero-card">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">验收链路</h2>
                <div className="panel-copy">服务器 → wipe → 统计组 → 组内字段 → 榜单过滤 → 玩家跨组汇总 → 当前组对比</div>
              </div>
            </div>
            <div className="summary-grid">
              <div className="summary-card">
                <span className="metric-label">Server</span>
                <strong>{serverDetail?.server?.name || "—"}</strong>
              </div>
              <div className="summary-card">
                <span className="metric-label">Wipe</span>
                <strong>{selectedWipeId || "Current"}</strong>
              </div>
              <div className="summary-card">
                <span className="metric-label">Group</span>
                <strong>{currentGroup?.name || "—"}</strong>
              </div>
            </div>
            <div style={{ height: 12 }} />
            {pageError ? <div className="status error">{pageError}</div> : null}
            {!pageError ? (
              <div className="status">
                真实测试玩家建议: <strong>`Lizard_Wizard`</strong>、<strong>`-fly`</strong>、<strong>`Ignignokt`</strong>
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
                  <div className="panel-copy">切换服务器后自动绑定该服最新 wipe，并同步所有统计组。</div>
                </div>
              </div>
              {catalogLoading ? <div className="status">正在加载 Rusticated 服务器...</div> : null}
              <div className="server-grid">
                {catalog.servers.map((server) => (
                  <button
                    key={server.id}
                    className={`server-card ${server.id === selectedServerId ? "active" : "secondary"}`}
                    onClick={() => startTransition(() => setSelectedServerId(server.id))}
                  >
                    <div>
                      <span className="server-card-title">{server.name}</span>
                      <span className="server-card-meta">
                        {server.population?.players ?? 0}/{server.population?.maxPlayers ?? 0} · {server.maxTeamSize || "?"} max
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">统计组</h3>
                  <div className="panel-copy">字段来自 `leaderboard/stat-groups`，默认排序来自每组第一个 statType。</div>
                </div>
              </div>
              {serverLoading ? <div className="status">正在同步当前服务器详情...</div> : null}
              <div className="group-grid">
                {(serverDetail?.groups || catalog.groups).map((group) => (
                  <button
                    key={group.id}
                    className={`chip ${group.id === selectedGroupId ? "active" : ""}`}
                    onClick={() => {
                      startTransition(() => {
                        setSelectedGroupId(group.id);
                        setSelectedSortBy(group.defaultSort || "");
                        setSortDir("desc");
                        setOffset(0);
                        setSelectedCompareKey("");
                      });
                    }}
                  >
                    <strong>{group.name}</strong>
                    <small>{group.id}</small>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <main className="content">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">排行榜查询</h3>
                  <div className="panel-copy">
                    当前接口: <code>/api/rusticated/servers/{selectedServerId || "{server}"}/leaderboards/{selectedGroupId || "{group}"}</code>
                  </div>
                </div>
              </div>

              <div className="toolbar">
                <label className="field-group">
                  <span className="field-label">Wipe</span>
                  <select
                    className="control"
                    value={selectedWipeId}
                    onChange={(event) => {
                      setSelectedWipeId(event.target.value);
                      setOffset(0);
                    }}
                  >
                    {(serverDetail?.wipes || []).map((wipe) => (
                      <option key={wipe.id} value={wipe.id}>{new Date(wipe.startedAt).toLocaleString("sv-SE")}</option>
                    ))}
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Sort By</span>
                  <select
                    className="control"
                    value={selectedSortBy}
                    onChange={(event) => {
                      setSelectedSortBy(event.target.value);
                      setOffset(0);
                    }}
                  >
                    {currentFields.map((field) => (
                      <option key={field.id} value={field.id}>{field.name}</option>
                    ))}
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Sort Dir</span>
                  <select
                    className="control"
                    value={sortDir}
                    onChange={(event) => {
                      setSortDir(event.target.value);
                      setOffset(0);
                    }}
                  >
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </label>

                <form className="toolbar-inline" onSubmit={submitFilter}>
                  <label className="field-group">
                    <span className="field-label">Current Group Filter</span>
                    <input
                      className="control"
                      placeholder="输入玩家名过滤当前榜单"
                      value={filterInput}
                      onChange={(event) => setFilterInput(event.target.value)}
                    />
                  </label>
                  <div className="split-actions">
                    <button className="button" type="submit">应用过滤</button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => {
                        setFilterInput("");
                        setFilterValue("");
                        setOffset(0);
                      }}
                    >
                      清空
                    </button>
                  </div>
                </form>
              </div>

              {leaderboardLoading ? <div className="status">正在拉取当前 Rusticated 榜单...</div> : null}

              <div className="summary-grid">
                <div className="summary-card">
                  <span className="metric-label">Page</span>
                  <strong>{currentPage}</strong>
                </div>
                <div className="summary-card">
                  <span className="metric-label">Total Pages</span>
                  <strong>{totalPages}</strong>
                </div>
                <div className="summary-card">
                  <span className="metric-label">Filter</span>
                  <strong>{filterValue || "All Players"}</strong>
                </div>
              </div>

              <div style={{ height: 16 }} />

              <div className="fields-grid">
                {currentFields.map((field) => (
                  <div key={field.id} className="field-chip">
                    <strong>{field.name}</strong>
                    <span>{field.id}</span>
                  </div>
                ))}
              </div>

              <div style={{ height: 16 }} />

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      {currentFields.map((field) => (
                        <th key={field.id}>{field.name}</th>
                      ))}
                      <th>Compare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row) => (
                      <tr key={`${rowKey(row)}-${row.rank}`}>
                        <td>{row.rank}</td>
                        <td>
                          <div className="table-user">
                            {row.avatarUrl ? <img src={row.avatarUrl} alt={row.username} /> : <span className="table-user-fallback">{initialsFromName(row.username)}</span>}
                            <div>
                              {row.steamId ? <a href={`https://steamcommunity.com/profiles/${row.steamId}`} target="_blank" rel="noreferrer">{row.username}</a> : <strong>{row.username || "Unknown"}</strong>}
                              <div className="metric-subvalue">{row.steamId || "No Steam ID"}</div>
                            </div>
                          </div>
                        </td>
                        {currentFields.map((field) => (
                          <td key={`${rowKey(row)}-${field.id}`}>{formatMetric(getFieldValue(row, field), field)}</td>
                        ))}
                        <td>
                          <button
                            className={`button ${selectedCompareKey === rowKey(row) ? "active" : "secondary"}`}
                            onClick={() => setSelectedCompareKey(rowKey(row))}
                          >
                            对比
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!currentRows.length ? (
                      <tr>
                        <td colSpan={currentFields.length + 3}>当前筛选下没有返回榜单数据。</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-copy">
                  Showing {offset + 1} to {Math.min(offset + PAGE_SIZE, leaderboard?.total || offset)} of {leaderboard?.total || 0}
                </div>
                <div className="split-actions">
                  <button
                    className="button secondary"
                    disabled={offset <= 0}
                    onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
                  >
                    上一页
                  </button>
                  <button
                    className="button secondary"
                    disabled={offset + PAGE_SIZE >= (leaderboard?.total || 0)}
                    onClick={() => setOffset((current) => current + PAGE_SIZE)}
                  >
                    下一页
                  </button>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">玩家跨组查询</h3>
                  <div className="panel-copy">会在当前服务器与当前 wipe 下遍历全部统计组，并返回每一组里的匹配记录。</div>
                </div>
              </div>

              <form className="toolbar" onSubmit={runPlayerSearch}>
                <label className="field-group" style={{ minWidth: 280 }}>
                  <span className="field-label">Player Name</span>
                  <input
                    className="control"
                    placeholder="例如 Lizard_Wizard"
                    value={playerInput}
                    onChange={(event) => setPlayerInput(event.target.value)}
                  />
                </label>
                <div className="split-actions">
                  <button className="button" type="submit">跨组查询</button>
                </div>
              </form>

              {playerLoading ? <div className="status">正在遍历 Rusticated 全部统计组查询玩家...</div> : null}
              {playerSummary ? (
                <div className="status">
                  当前玩家在 <strong>{playerSummary.matchedGroups}</strong> 个统计组中有结果。
                  识别身份:
                  {" "}
                  <strong>{playerSummary.identity?.username || "未命中"}</strong>
                </div>
              ) : null}

              <div style={{ height: 16 }} />

              <div className="lookup-grid">
                {(playerSummary?.groups || []).map((item) => (
                  <div key={item.group.id} className="lookup-card">
                    <header>
                      <div>
                        <strong>{item.group.name}</strong>
                        <div className="metric-subvalue">{item.fields.length} 个字段</div>
                      </div>
                      <span className="lookup-match">{item.selectedMatch ? "Matched" : "No Match"}</span>
                    </header>
                    {item.selectedMatch ? (
                      <>
                        <div className="metric-value" style={{ marginTop: 14, fontSize: 20 }}>{item.selectedMatch.username}</div>
                        <div className="lookup-fields">
                          {summarizeFields(item.selectedMatch, item.fields, 5).map(({ field, value }) => (
                            <div key={field.id} className="lookup-field">
                              <span>{field.name}</span>
                              <strong>{formatMetric(value, field)}</strong>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="metric-subvalue" style={{ marginTop: 14 }}>该组下没有匹配到当前玩家。</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">当前组对比</h3>
                  <div className="panel-copy">将当前组里命中的玩家数据，与榜单选中的行做字段级对比。</div>
                </div>
              </div>

              <div className="compare-grid">
                <div className="compare-card">
                  <header>
                    <div>
                      <strong>{playerRow?.username || "玩家未命中"}</strong>
                      <div className="metric-subvalue">{currentGroup?.name || "—"}</div>
                    </div>
                    <span className="compare-total">Player Query</span>
                  </header>
                  <div className="compare-fields">
                    {playerRow ? summarizeFields(playerRow, currentFields, 8).map(({ field, value }) => (
                      <div key={field.id} className="compare-field">
                        <span>{field.name}</span>
                        <strong>{formatMetric(value, field)}</strong>
                        <span />
                      </div>
                    )) : <div className="metric-subvalue">先执行玩家查询，且该玩家需要在当前组中有结果。</div>}
                  </div>
                </div>

                <div className="compare-card">
                  <header>
                    <div>
                      <strong>{compareRow?.username || "未选择榜单行"}</strong>
                      <div className="metric-subvalue">排行榜对比对象</div>
                    </div>
                    <span className="compare-total">Leaderboard</span>
                  </header>
                  <div className="compare-fields">
                    {compareRow ? summarizeFields(compareRow, currentFields, 8).map(({ field, value }) => {
                      const delta = playerRow ? deltaText(getFieldValue(playerRow, field), value, field) : "—";
                      return (
                        <div key={field.id} className="compare-field">
                          <span>{field.name}</span>
                          <strong>{formatMetric(value, field)}</strong>
                          <span className={delta.startsWith("+") ? "delta-positive" : delta.startsWith("-") ? "delta-negative" : ""}>
                            {delta}
                          </span>
                        </div>
                      );
                    }) : <div className="metric-subvalue">从榜单中选择一行即可开始对比。</div>}
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
