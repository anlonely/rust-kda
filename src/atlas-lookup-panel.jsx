import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function buildUrl(path, params) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}`;
}

function initialsFromName(value) {
  return String(value || "?").slice(0, 2).toUpperCase();
}

function formatAtlasValue(value, locale) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return value.toLocaleString(locale, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    });
  }
  return String(value);
}

function fieldIdFromLabel(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AtlasLookupPanel({
  t,
  locale = "zh-CN",
  meta,
  preferredSteamId = "",
}) {
  const [steamInput, setSteamInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!preferredSteamId || steamInput) return;
    setSteamInput(preferredSteamId);
  }, [preferredSteamId, steamInput]);

  async function runLookup(event) {
    event?.preventDefault();
    const steamId = steamInput.trim();
    if (!steamId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(buildUrl("/atlas/player-search", { steamId }));
      const nextPayload = await response.json().catch(() => ({}));
      if (!response.ok && !nextPayload?.query) {
        throw new Error(nextPayload.error || `Request failed (${response.status})`);
      }
      setPayload(nextPayload);
      if (!nextPayload?.found) {
        setError(nextPayload?.error || `Request failed (${response.status})`);
      }
    } catch (fetchError) {
      setPayload(null);
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  const identity = payload?.identity || {};
  const highlights = payload?.highlights || {};
  const metrics = payload?.metrics || [];
  const bans = payload?.bans || [];
  const clans = payload?.clans || [];
  const steamLink = identity?.steamProfileUrl || "";
  const battlemetricsLink = identity?.battlemetricsUrl || "";
  const hasProfile = Boolean(payload?.found && identity?.playerName);

  return (
    <div className="lb-layout">
      <aside className="lb-sidebar">
        <section className="neon-panel lb-panel">
          <div className="lb-panel-head">
            <div>
              <div className="lb-panel-title">{meta.name}</div>
              <div className="lb-panel-copy">{t[meta.hintKey]}</div>
            </div>
          </div>

          <div className="lb-summary-row" style={{ marginBottom: 16 }}>
            <span className="lb-summary-chip">{t.currentSite}: {meta.name}</span>
            <span className="lb-summary-chip">{t.currentSteamId}: {steamInput || "—"}</span>
          </div>

          <form onSubmit={runLookup} className="lb-toolbar">
            <label className="lb-field-group" style={{ flex: 1 }}>
              <span className="lb-field-label">{t.steam64}</span>
              <input
                className="lb-control"
                value={steamInput}
                onChange={(event) => setSteamInput(event.target.value)}
                placeholder={t.atlasLookupPlaceholder}
              />
            </label>
            <button className="lb-button primary" style={{ alignSelf: "end" }} type="submit">
              {loading ? t.loadingPlayer : t.load}
            </button>
          </form>

          <div className="lb-copy" style={{ marginTop: 14 }}>
            {preferredSteamId ? (
              <>
                {t.independent}
                {" "}
                <button
                  className="lb-button"
                  onClick={() => setSteamInput(preferredSteamId)}
                  style={{ marginLeft: 8 }}
                >
                  {t.useCurrentSteamId}: {preferredSteamId}
                </button>
              </>
            ) : (
              `${t.independent} ${t.noCurrentSteamId}`
            )}
          </div>

          {loading ? <div className="lb-status" style={{ marginTop: 14 }}>{t.loadingPlayer}</div> : null}
          {error ? <div className="lb-error" style={{ marginTop: 14 }}>{error}</div> : null}
          {!payload && !loading ? <div className="lb-status" style={{ marginTop: 14 }}>{t.atlasEmpty}</div> : null}
        </section>
      </aside>

      <main className="lb-main">
        <section className="neon-panel lb-panel">
          <div className="lb-panel-head">
            <div>
              <div className="lb-panel-title">{t.atlasTitle}</div>
              <div className="lb-panel-copy">{t.atlasCopy}</div>
            </div>
            <div className="lb-summary-row">
              <span className="lb-summary-chip">Steam64: {payload?.steamId || steamInput || "—"}</span>
              <span className="lb-summary-chip">BM ID: {identity?.battlemetricsPlayerId || "—"}</span>
              <span className="lb-summary-chip">{t.bans}: {payload?.banCount || 0}</span>
            </div>
          </div>

          {!hasProfile ? (
            <div className="lb-status">{payload?.error || t.profileUnavailable}</div>
          ) : (
            <>
              <div className="lb-compare-grid">
                <div className="lb-compare-card">
                  <span className="lb-card-label">{t.player}</span>
                  <div className="lb-player-cell" style={{ marginTop: 10 }}>
                    {identity?.avatar ? (
                      <img className="lb-avatar" src={identity.avatar} alt="" />
                    ) : (
                      <span className="lb-avatar-fallback">{initialsFromName(identity?.playerName)}</span>
                    )}
                    <div>
                      <strong>{identity?.playerName || "—"}</strong>
                      <span className="lb-subline">{payload?.steamId || "—"}</span>
                      <span className="lb-subline">{identity?.countryCode || "—"}</span>
                    </div>
                  </div>
                  <ul>
                    <li><span>{t.status}</span><strong>{(identity?.statusChips || []).join(" · ") || "—"}</strong></li>
                    <li><span>{t.profileMeta}</span><strong>{(identity?.metaItems || []).join(" · ") || "—"}</strong></li>
                    <li><span>Steam</span><strong>{steamLink ? <a href={steamLink} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{t.openLink}</a> : "—"}</strong></li>
                    <li><span>BattleMetrics</span><strong>{battlemetricsLink ? <a href={battlemetricsLink} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{t.openLink}</a> : "—"}</strong></li>
                  </ul>
                </div>

                <div className="lb-compare-card">
                  <span className="lb-card-label">{t.atlasHighlights}</span>
                  <strong>{identity?.playerName || "—"}</strong>
                  <ul>
                    <li><span>BattleMetrics</span><strong>{highlights?.battlemetricsText || formatAtlasValue(highlights?.battlemetricsHours, locale)}</strong></li>
                    <li><span>Atlas</span><strong>{highlights?.atlasText || formatAtlasValue(highlights?.atlasHours, locale)}</strong></li>
                    <li><span>K/D</span><strong>{highlights?.kdText || formatAtlasValue(highlights?.kdRatio, locale)}</strong></li>
                    <li><span>Accuracy</span><strong>{highlights?.accuracyText || formatAtlasValue(highlights?.accuracy, locale)}</strong></li>
                  </ul>
                </div>
              </div>

              <div className="lb-player-grid" style={{ marginTop: 16 }}>
                {metrics.map((metric) => (
                  <div key={fieldIdFromLabel(metric.label)} className="lb-player-card">
                    <span className="lb-card-label">{metric.label || "Metric"}</span>
                    <strong>{metric.valueText || formatAtlasValue(metric.value, locale)}</strong>
                    <span className="lb-subline">{metric.sub || "—"}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="neon-panel lb-panel">
          <div className="lb-panel-head">
            <div>
              <div className="lb-panel-title">{t.atlasRecords}</div>
              <div className="lb-panel-copy">{t.atlasRecordsCopy}</div>
            </div>
          </div>

          <div className="lb-player-grid">
            <div className="lb-player-card">
              <span className="lb-card-label">{t.bans}</span>
              <strong>{bans.length ? `${bans.length}` : t.noneLabel}</strong>
              <ul>
                {(bans.length ? bans : [{ reason: t.noBans, summary: "—" }]).slice(0, 6).map((ban, index) => (
                  <li key={`ban-${index}`}>
                    <span>{ban.reason || t.bans}</span>
                    <strong>{ban.summary || "—"}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lb-player-card">
              <span className="lb-card-label">{t.clans}</span>
              <strong>{clans.length ? `${clans.length}` : t.noneLabel}</strong>
              <ul>
                {(clans.length ? clans : [{ name: t.noClans, details: "—", meta: "—" }]).slice(0, 6).map((clan, index) => (
                  <li key={`clan-${index}`}>
                    <span>{clan.name || t.clans}</span>
                    <strong>{[clan.details, clan.meta].filter(Boolean).join(" · ") || "—"}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
