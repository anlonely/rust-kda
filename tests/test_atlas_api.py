from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import rust_query_server_v2 as srv


def fake_fetch_atlas_meta():
    return {
        "source": "https://atlasrust.com/player-lookup",
        "lookupMode": "steam64",
        "requiresSteamId": True,
        "playerFields": [
            "steam_id",
            "name",
            "country",
            "bm_player_id",
            "bm_hours",
            "atlas_hours",
            "stats_global",
            "bans",
            "isOnline",
        ],
    }


def fake_fetch_atlas_player_summary(steam_id):
    if steam_id == "76561198795260945":
        return {
            "steamId": steam_id,
            "query": {"steamId": steam_id},
            "source": "https://atlasrust.com/player-lookup",
            "statusCode": 200,
            "found": True,
            "error": "",
            "identity": {
                "steamId": steam_id,
                "playerName": "DINASTÍA",
                "avatar": "https://example.com/avatar.png",
                "countryCode": "US",
                "steamProfileUrl": f"https://steamcommunity.com/profiles/{steam_id}",
                "battlemetricsUrl": "https://www.battlemetrics.com/players/1191996257",
                "battlemetricsPlayerId": "1191996257",
                "statusChips": ["Online", "Premium"],
                "metaItems": ["Last Seen: 2h ago", "First Seen: 2026-03-01"],
            },
            "highlights": {
                "battlemetricsHours": 502000,
                "battlemetricsText": "502K hours",
                "atlasHours": 11400,
                "atlasText": "11.4K hours",
                "kdRatio": 4.25,
                "kdText": "4.25",
                "accuracy": 23,
                "accuracyText": "23%",
                "accuracySubtext": "HS: 14%",
            },
            "metrics": [
                {"label": "BattleMetrics", "value": 502000, "valueText": "502K hours", "sub": "Synced: 2h ago"},
                {"label": "Atlas Playtime", "value": 11400, "valueText": "11.4K hours", "sub": "Current Atlas hours"},
                {"label": "K/D Ratio", "value": 4.25, "valueText": "4.25", "sub": "120 K • 28 D"},
                {"label": "Accuracy", "value": 23, "valueText": "23%", "sub": "HS: 14%"},
            ],
            "bans": [{"reason": "Cheating", "summary": "Cheating Active"}],
            "banCount": 1,
            "clans": [{"name": "TRIO", "details": "Joined 2026-03-20", "meta": "Current"}],
        }
    if steam_id == "76561199886302710":
        return {
            "steamId": steam_id,
            "query": {"steamId": steam_id},
            "source": "https://atlasrust.com/player-lookup",
            "statusCode": 405,
            "found": False,
            "error": "Access Denied.",
            "identity": {
                "steamId": steam_id,
                "playerName": None,
                "avatar": None,
                "countryCode": None,
                "steamProfileUrl": None,
                "battlemetricsUrl": None,
                "battlemetricsPlayerId": None,
                "statusChips": [],
                "metaItems": [],
            },
            "highlights": {},
            "metrics": [],
            "bans": [],
            "banCount": 0,
            "clans": [],
        }
    raise ValueError("请提供 17 位 Steam64 ID")


def test_api_atlas_meta_returns_lookup_profile(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "fetch_atlas_meta", fake_fetch_atlas_meta)

    response = client.get("/api/atlas/meta")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["lookupMode"] == "steam64"
    assert payload["playerFields"][0] == "steam_id"


def test_api_atlas_player_search_returns_player_payload(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "fetch_atlas_player_summary", fake_fetch_atlas_player_summary)

    response = client.get("/api/atlas/player-search?steamId=76561198795260945")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["found"] is True
    assert payload["identity"]["playerName"] == "DINASTÍA"
    assert payload["highlights"]["kdRatio"] == 4.25
    assert payload["bans"][0]["reason"] == "Cheating"


def test_api_atlas_player_search_returns_site_block_payload(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "fetch_atlas_player_summary", fake_fetch_atlas_player_summary)

    response = client.get("/api/atlas/player-search?steamId=76561199886302710")
    payload = response.get_json()

    assert response.status_code == 502
    assert payload["found"] is False
    assert payload["error"] == "Access Denied."


def test_api_atlas_player_search_requires_steam_id():
    client = srv.app.test_client()

    response = client.get("/api/atlas/player-search")
    payload = response.get_json()

    assert response.status_code == 400
    assert payload["error"] == "请提供 Steam64 ID"
