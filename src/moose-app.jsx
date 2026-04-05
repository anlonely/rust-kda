import React, { startTransition, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const MOOSE_API = `${API_BASE}/moose`;

const styles = `
:root {
  color-scheme: dark;
  --bg: #091015;
  --panel: rgba(12, 18, 24, 0.86);
  --panel-strong: rgba(16, 24, 32, 0.96);
  --line: rgba(147, 197, 253, 0.16);
  --line-strong: rgba(147, 197, 253, 0.28);
  --text: #eff6ff;
  --muted: #94a3b8;
  --accent: #7dd3fc;
  --accent-strong: #38bdf8;
  --accent-warm: #f59e0b;
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
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.16), transparent 32%),
    radial-gradient(circle at top right, rgba(245, 158, 11, 0.14), transparent 24%),
    linear-gradient(180deg, #071017 0%, #091015 48%, #081018 100%);
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
  grid-template-columns: 1.3fr 0.9fr;
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
  border: 1px solid rgba(125, 211, 252, 0.24);
  background: rgba(125, 211, 252, 0.08);
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
  max-width: 60ch;
  color: var(--muted);
  line-height: 1.65;
}

.hero-metrics,
.summary-grid,
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

.server-grid,
.category-grid {
  display: grid;
  gap: 12px;
}

.server-grid {
  grid-template-columns: repeat(auto-fill, minmax(142px, 1fr));
}

.category-grid {
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
}

.button,
.chip,
.control {
  border-radius: 16px;
  border: 1px solid var(--line);
  transition: 160ms ease;
}

.button,
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
  background: linear-gradient(135deg, rgba(125, 211, 252, 0.18), rgba(56, 189, 248, 0.12));
  color: var(--text);
}

.button.secondary,
.server-card.secondary,
.chip {
  background: rgba(255, 255, 255, 0.04);
}

.button:hover,
.chip:hover,
.server-card:hover {
  border-color: var(--line-strong);
  transform: translateY(-1px);
}

.button.active,
.chip.active,
.server-card.active {
  border-color: rgba(245, 158, 11, 0.45);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.06));
}

.server-card {
  text-align: left;
  justify-content: flex-start;
  width: 100%;
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

.chip small {
  display: block;
  margin-top: 5px;
  color: var(--muted);
}

.fields-grid,
.lookup-grid,
.compare-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
  box-shadow: 0 0 0 3px rgba(125, 211, 252, 0.12);
}

.status {
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(245, 158, 11, 0.18);
  background: rgba(245, 158, 11, 0.08);
  color: #fcd34d;
}

.status.error {
  border-color: rgba(244, 63, 94, 0.2);
  background: rgba(244, 63, 94, 0.08);
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
  background: rgba(9, 16, 21, 0.96);
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
  background: rgba(125, 211, 252, 0.14);
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
  border: 1px solid rgba(125, 211, 252, 0.2);
  background: rgba(125, 211, 252, 0.08);
  color: var(--accent);
}

.compare-total {
  border: 1px solid rgba(245, 158, 11, 0.18);
  background: rgba(245, 158, 11, 0.08);
  color: var(--accent-warm);
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
  .category-grid,
  .fields-grid,
  .lookup-grid,
  .compare-grid {
    grid-template-columns: 1fr;
  }
}
`;

function buildUrl(path, params = {}) {
  const url = new URL(`${MOOSE_API}${path}`, window.location.origin);
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
  return row?.steamId || row?.playerUrl || row?.playerName || "";
}

function getFieldValue(row, field) {
  return row?.values?.[field.id] || "—";
}

function parseComparableNumber(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("/") || /[a-z]/i.test(raw.replace(/[%.,\-\s]/g, ""))) return null;
  const normalized = raw.replace(/,/g, "").replace(/%$/, "");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatDelta(left, right) {
  const leftNum = parseComparableNumber(left);
  const rightNum = parseComparableNumber(right);
  if (leftNum === null || rightNum === null) return "—";
  const delta = leftNum - rightNum;
  if (delta === 0) return "0";
  const suffix = String(left || right || "").trim().endsWith("%") ? "%" : "";
  return `${delta > 0 ? "+" : ""}${delta.toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`;
}

function summarizeFields(row, fields, limit = 4) {
  if (!row) return [];
  return fields
    .map((field) => ({ field, value: getFieldValue(row, field) }))
    .filter((item) => item.value && item.value !== "—")
    .slice(0, limit);
}

export default function MooseApp() {
  const [catalog, setCatalog] = useState({ servers: [], categories: [] });
  const [selectedServerId, setSelectedServerId] = useState("");
  const [serverDetail, setServerDetail] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [leaderboard, setLeaderboard] = useState(null);
  const [page, setPage] = useState(1);
  const [tableSearchInput, setTableSearchInput] = useState("");
  const [tableSearch, setTableSearch] = useState("");
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
          categories: payload.categories || [],
        });
        if (payload.servers?.length && !selectedServerId) {
          setSelectedServerId(payload.servers[0].id);
        }
        if (payload.categories?.length && !selectedCategoryId) {
          setSelectedCategoryId(payload.categories[0].id);
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
          const nextCategoryId = (payload.categories || []).some((item) => item.id === selectedCategoryId)
            ? selectedCategoryId
            : payload.categories?.[0]?.id || "";
          const nextPeriod = (payload.periods || []).some((item) => item.name === selectedPeriod)
            ? selectedPeriod
            : payload.periods?.[0]?.name || "";
          setSelectedCategoryId(nextCategoryId);
          setSelectedPeriod(nextPeriod);
          setPage(1);
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
    if (!selectedServerId || !selectedCategoryId) return;
    let alive = true;
    setLeaderboardLoading(true);
    fetchJson(`/servers/${encodeURIComponent(selectedServerId)}/leaderboards/${encodeURIComponent(selectedCategoryId)}`, {
      period: selectedPeriod,
      search: tableSearch,
      page,
    })
      .then((payload) => {
        if (!alive) return;
        setLeaderboard(payload);
        if (payload.pagination?.currentPage && payload.pagination.currentPage !== page) {
          setPage(payload.pagination.currentPage);
        }
        const nextKey = rowKey(payload.rows?.[0]);
        setSelectedCompareKey((current) => {
          if (!current) return nextKey;
          return payload.rows?.some((row) => rowKey(row) === current) ? current : nextKey;
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
  }, [selectedServerId, selectedCategoryId, selectedPeriod, tableSearch, page]);

  const currentCategory = (serverDetail?.categories || catalog.categories).find((item) => item.id === selectedCategoryId) || null;
  const currentFields = leaderboard?.fields || [];
  const currentRows = leaderboard?.rows || [];
  const compareRow = currentRows.find((row) => rowKey(row) === selectedCompareKey) || currentRows[0] || null;
  const currentPlayerCategory = playerSummary?.categories?.find((item) => item.category.id === selectedCategoryId) || null;
  const playerRow = currentPlayerCategory?.selectedMatch || null;

  async function submitTableSearch(event) {
    event.preventDefault();
    startTransition(() => {
      setPage(1);
      setTableSearch(tableSearchInput.trim());
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
        username: playerInput.trim(),
        period: selectedPeriod,
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
            <div className="kicker">Moose.GG Live Stats</div>
            <h1 className="hero-title">Moose 排行榜本地查询台</h1>
            <p className="hero-copy">
              直接从 <code>moose.gg/stats</code> 的真实页面抓取服务器、时间范围、分类列头、榜单行和玩家结果。
              现在这套站点支持先选服务器，再看具体分类和字段，再做当前榜单过滤与跨分类玩家查询。
            </p>
            <div className="hero-metrics">
              <div className="metric-card">
                <span className="metric-label">Servers</span>
                <span className="metric-value">{catalog.servers.length}</span>
                <span className="metric-subvalue">包含 `Global` 与 Moose 全部可选服务器</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Categories</span>
                <span className="metric-value">{catalog.categories.length}</span>
                <span className="metric-subvalue">PvP / PvE / Gambling / Resources 等全部类型</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Current Rows</span>
                <span className="metric-value">{leaderboard?.rows?.length ?? 0}</span>
                <span className="metric-subvalue">当前页面实际返回的榜单行数</span>
              </div>
            </div>
          </div>

          <div className="hero-card">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">验收链路</h2>
                <div className="panel-copy">服务器列表 → 时间范围 → 分类列头 → 当前榜单 → 玩家跨分类查询 → 当前分类对比</div>
              </div>
            </div>
            <div className="summary-grid">
              <div className="summary-card">
                <span className="metric-label">Server</span>
                <strong>{serverDetail?.server?.name || "—"}</strong>
              </div>
              <div className="summary-card">
                <span className="metric-label">Period</span>
                <strong>{selectedPeriod || "All Time"}</strong>
              </div>
              <div className="summary-card">
                <span className="metric-label">Category</span>
                <strong>{currentCategory?.name || "—"}</strong>
              </div>
            </div>
            <div style={{ height: 12 }} />
            {pageError ? <div className="status error">{pageError}</div> : null}
            {!pageError ? (
              <div className="status">
                真实测试玩家建议: <strong>`Ignignokt`</strong>、<strong>`.qT Olzi`</strong>、<strong>`ararar`</strong>
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
                  <div className="panel-copy">来源于 Moose 页面首个下拉框。切换服务器后会同步拉取可用时间范围。</div>
                </div>
              </div>
              {catalogLoading ? <div className="status">正在抓取 Moose 服务器列表...</div> : null}
              <div className="server-grid">
                {catalog.servers.map((server) => (
                  <button
                    key={server.id}
                    className={`server-card ${server.id === selectedServerId ? "active" : "secondary"}`}
                    onClick={() => startTransition(() => setSelectedServerId(server.id))}
                  >
                    <div>
                      <span className="server-card-title">{server.name}</span>
                      <span className="server-card-meta">{server.name === "Global" ? "全局排行" : "Moose 独立服务器"}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">分类</h3>
                  <div className="panel-copy">分类来自 Moose 页签。字段由当前分类表头动态生成。</div>
                </div>
              </div>
              {serverLoading ? <div className="status">正在同步当前服务器的可用时间和分类...</div> : null}
              <div className="category-grid">
                {(serverDetail?.categories || catalog.categories).map((category) => (
                  <button
                    key={category.id}
                    className={`chip ${category.id === selectedCategoryId ? "active" : ""}`}
                    onClick={() => {
                      startTransition(() => {
                        setSelectedCategoryId(category.id);
                        setPage(1);
                        setSelectedCompareKey("");
                      });
                    }}
                  >
                    <strong>{category.name}</strong>
                    <small>{category.id}</small>
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
                    当前接口: <code>/api/moose/servers/{selectedServerId || "{server}"}/leaderboards/{selectedCategoryId || "{category}"}</code>
                  </div>
                </div>
              </div>

              <div className="toolbar">
                <label className="field-group">
                  <span className="field-label">Period</span>
                  <select
                    className="control"
                    value={selectedPeriod}
                    onChange={(event) => {
                      setSelectedPeriod(event.target.value);
                      setPage(1);
                    }}
                  >
                    {(serverDetail?.periods || []).map((period) => (
                      <option key={period.id} value={period.name}>{period.name}</option>
                    ))}
                  </select>
                </label>

                <form className="toolbar-inline" onSubmit={submitTableSearch}>
                  <label className="field-group">
                    <span className="field-label">Current Type Filter</span>
                    <input
                      className="control"
                      placeholder="输入玩家名过滤当前榜单"
                      value={tableSearchInput}
                      onChange={(event) => setTableSearchInput(event.target.value)}
                    />
                  </label>
                  <div className="split-actions">
                    <button className="button" type="submit">应用过滤</button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => {
                        setTableSearchInput("");
                        setTableSearch("");
                        setPage(1);
                      }}
                    >
                      清空
                    </button>
                  </div>
                </form>
              </div>

              {leaderboardLoading ? <div className="status">正在抓取当前榜单...</div> : null}

              <div className="summary-grid">
                <div className="summary-card">
                  <span className="metric-label">Page</span>
                  <strong>{leaderboard?.pagination?.currentPage ?? 1}</strong>
                </div>
                <div className="summary-card">
                  <span className="metric-label">Visible Pages</span>
                  <strong>{leaderboard?.pagination?.visiblePages?.length ?? 0}</strong>
                </div>
                <div className="summary-card">
                  <span className="metric-label">Search</span>
                  <strong>{tableSearch || "All Players"}</strong>
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
                            {row.avatar ? <img src={row.avatar} alt={row.playerName} /> : <span className="table-user-fallback">{initialsFromName(row.playerName)}</span>}
                            <div>
                              {row.playerUrl ? <a href={row.playerUrl} target="_blank" rel="noreferrer">{row.playerName}</a> : <strong>{row.playerName}</strong>}
                              <div className="metric-subvalue">{row.steamId || "No Steam ID"}</div>
                            </div>
                          </div>
                        </td>
                        {currentFields.map((field) => (
                          <td key={`${rowKey(row)}-${field.id}`}>{getFieldValue(row, field)}</td>
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
                  可见页码:
                  {" "}
                  {(leaderboard?.pagination?.visiblePages || []).map((item) => item.page).join(", ") || "1"}
                </div>
                <div className="split-actions">
                  <button
                    className="button secondary"
                    disabled={!leaderboard?.pagination?.hasPrevious}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    上一页
                  </button>
                  {(leaderboard?.pagination?.visiblePages || []).map((item) => (
                    <button
                      key={item.page}
                      className={`button ${item.page === (leaderboard?.pagination?.currentPage || 1) ? "active" : "secondary"}`}
                      onClick={() => setPage(item.page)}
                    >
                      {item.page}
                    </button>
                  ))}
                  <button
                    className="button secondary"
                    disabled={!leaderboard?.pagination?.hasNext}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    下一页
                  </button>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">玩家跨分类查询</h3>
                  <div className="panel-copy">输入玩家名称后，会在当前服务器与时间范围下遍历全部 Moose 分类，并返回每个分类里的匹配结果。</div>
                </div>
              </div>
              <form className="toolbar" onSubmit={runPlayerSearch}>
                <label className="field-group" style={{ minWidth: 280 }}>
                  <span className="field-label">Player Name</span>
                  <input
                    className="control"
                    placeholder="例如 Ignignokt"
                    value={playerInput}
                    onChange={(event) => setPlayerInput(event.target.value)}
                  />
                </label>
                <div className="split-actions">
                  <button className="button" type="submit">跨分类查询</button>
                </div>
              </form>

              {playerLoading ? <div className="status">正在遍历 Moose 全部分类查询玩家...</div> : null}
              {playerSummary ? (
                <div className="status">
                  当前玩家在 <strong>{playerSummary.matchedCategories}</strong> 个分类中有结果。
                  识别身份:
                  {" "}
                  <strong>{playerSummary.identity?.playerName || "未命中"}</strong>
                </div>
              ) : null}

              <div style={{ height: 16 }} />

              <div className="lookup-grid">
                {(playerSummary?.categories || []).map((item) => (
                  <div key={item.category.id} className="lookup-card">
                    <header>
                      <div>
                        <strong>{item.category.name}</strong>
                        <div className="metric-subvalue">{item.fields.length} 个字段</div>
                      </div>
                      <span className="lookup-match">{item.selectedMatch ? "Matched" : "No Match"}</span>
                    </header>
                    {item.selectedMatch ? (
                      <>
                        <div className="metric-value" style={{ marginTop: 14, fontSize: 20 }}>{item.selectedMatch.playerName}</div>
                        <div className="lookup-fields">
                          {summarizeFields(item.selectedMatch, item.fields, 5).map(({ field, value }) => (
                            <div key={field.id} className="lookup-field">
                              <span>{field.name}</span>
                              <strong>{value}</strong>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="metric-subvalue" style={{ marginTop: 14 }}>该分类下没有匹配到当前玩家。</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3 className="panel-title">当前分类对比</h3>
                  <div className="panel-copy">将玩家跨分类查询命中的当前分类结果，与榜单中选中的行做字段级对比。</div>
                </div>
              </div>

              <div className="compare-grid">
                <div className="compare-card">
                  <header>
                    <div>
                      <strong>{playerRow?.playerName || "玩家未命中"}</strong>
                      <div className="metric-subvalue">{currentCategory?.name || "—"}</div>
                    </div>
                    <span className="compare-total">Player Query</span>
                  </header>
                  <div className="compare-fields">
                    {playerRow ? summarizeFields(playerRow, currentFields, 8).map(({ field, value }) => (
                      <div key={field.id} className="compare-field">
                        <span>{field.name}</span>
                        <strong>{value}</strong>
                        <span />
                      </div>
                    )) : <div className="metric-subvalue">先执行玩家查询，且该玩家需要在当前分类中有结果。</div>}
                  </div>
                </div>

                <div className="compare-card">
                  <header>
                    <div>
                      <strong>{compareRow?.playerName || "未选择榜单行"}</strong>
                      <div className="metric-subvalue">排行榜对比对象</div>
                    </div>
                    <span className="compare-total">Leaderboard</span>
                  </header>
                  <div className="compare-fields">
                    {compareRow ? summarizeFields(compareRow, currentFields, 8).map(({ field, value }) => (
                      <div key={field.id} className="compare-field">
                        <span>{field.name}</span>
                        <strong>{value}</strong>
                        <span className={
                          formatDelta(getFieldValue(playerRow, field), value).startsWith("+")
                            ? "delta-positive"
                            : formatDelta(getFieldValue(playerRow, field), value).startsWith("-")
                              ? "delta-negative"
                              : ""
                        }>
                          {playerRow ? formatDelta(getFieldValue(playerRow, field), value) : "—"}
                        </span>
                      </div>
                    )) : <div className="metric-subvalue">从榜单中选择一行即可开始对比。</div>}
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
