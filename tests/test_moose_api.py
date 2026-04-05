from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import rust_query_server_v2 as srv


FAKE_CATALOG = {
    "source": "https://moose.gg/stats",
    "servers": [
        {"id": "global", "name": "Global", "active": True},
        {"id": "us-main-premium", "name": "US Main (Premium)", "active": False},
    ],
    "categories": [
        {"id": "pvp", "name": "PvP", "active": True},
        {"id": "resources", "name": "Resources", "active": False},
    ],
}


def fake_fetch_moose_catalog():
    return FAKE_CATALOG


def fake_fetch_moose_server_detail(server_id):
    server = next(item for item in FAKE_CATALOG["servers"] if item["id"] == server_id)
    return {
        "server": {**server, "active": True},
        "periods": [
            {"id": "all-time", "name": "All Time", "active": True},
            {"id": "04-02-2026-18-00-00", "name": "04/02/2026 18:00:00", "active": False},
        ],
        "categories": FAKE_CATALOG["categories"],
    }


def fake_fetch_moose_leaderboard(server_id, category_id, period_value="", search="", page_number=1):
    return {
        "server": {"id": server_id, "name": "Global" if server_id == "global" else "US Main (Premium)", "active": True},
        "category": next(item for item in FAKE_CATALOG["categories"] if item["id"] == category_id),
        "period": {"id": "all-time", "name": period_value or "All Time", "active": True},
        "fields": [
            {"id": "kdr", "name": "KDR", "kind": "text"},
            {"id": "kills", "name": "Kills", "kind": "text"},
        ],
        "headers": ["Player", "KDR", "Kills"],
        "rows": [
            {
                "rank": 1,
                "playerName": "Ignignokt",
                "avatar": "https://example.com/avatar.png",
                "playerUrl": "https://steamcommunity.com/profiles/76561198006834730",
                "steamId": "76561198006834730",
                "values": {"kdr": "20.16", "kills": "51,430"},
            }
        ],
        "pagination": {
            "currentPage": page_number,
            "visiblePages": [{"page": 1, "active": page_number == 1}],
            "hasPrevious": False,
            "hasNext": False,
            "pageSize": 1,
        },
        "query": {
            "serverId": server_id,
            "categoryId": category_id,
            "period": period_value or "All Time",
            "search": search,
            "page": page_number,
        },
    }


def fake_fetch_moose_player_summary(server_id, username, period_value=""):
    return {
        "server": {"id": server_id, "name": "Global", "active": True},
        "period": {"id": "all-time", "name": period_value or "All Time", "active": True},
        "identity": {
            "playerName": "Ignignokt",
            "avatar": "https://example.com/avatar.png",
            "playerUrl": "https://steamcommunity.com/profiles/76561198006834730",
            "steamId": "76561198006834730",
        },
        "categories": [
            {
                "category": {"id": "pvp", "name": "PvP", "active": True},
                "fields": [
                    {"id": "kdr", "name": "KDR", "kind": "text"},
                    {"id": "kills", "name": "Kills", "kind": "text"},
                ],
                "matchCount": 1,
                "exactMatchCount": 1,
                "selectedMatch": {
                    "rank": 1,
                    "playerName": username,
                    "avatar": "https://example.com/avatar.png",
                    "playerUrl": "https://steamcommunity.com/profiles/76561198006834730",
                    "steamId": "76561198006834730",
                    "values": {"kdr": "20.16", "kills": "51,430"},
                },
                "matches": [],
            },
            {
                "category": {"id": "resources", "name": "Resources", "active": False},
                "fields": [{"id": "wood", "name": "Wood", "kind": "text"}],
                "matchCount": 0,
                "exactMatchCount": 0,
                "selectedMatch": None,
                "matches": [],
            },
        ],
        "matchedCategories": 1,
    }


def test_api_moose_servers_returns_catalog(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "fetch_moose_catalog", fake_fetch_moose_catalog)

    response = client.get("/api/moose/servers")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["count"] == 2
    assert payload["servers"][0]["id"] == "global"
    assert payload["categories"][0]["id"] == "pvp"


def test_api_moose_server_detail_returns_periods(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "fetch_moose_server_detail", fake_fetch_moose_server_detail)

    response = client.get("/api/moose/servers/us-main-premium")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["server"]["id"] == "us-main-premium"
    assert payload["periods"][1]["name"] == "04/02/2026 18:00:00"


def test_api_moose_leaderboard_returns_rows_and_query(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "fetch_moose_leaderboard", fake_fetch_moose_leaderboard)

    response = client.get("/api/moose/servers/global/leaderboards/pvp?search=Ignignokt&page=2")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["rows"][0]["playerName"] == "Ignignokt"
    assert payload["query"]["search"] == "Ignignokt"
    assert payload["query"]["page"] == 2
    assert payload["fields"][0]["id"] == "kdr"


def test_api_moose_player_search_returns_category_matches(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "fetch_moose_player_summary", fake_fetch_moose_player_summary)

    response = client.get("/api/moose/player-search?serverId=global&username=Ignignokt")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["identity"]["steamId"] == "76561198006834730"
    assert payload["matchedCategories"] == 1
    assert payload["categories"][0]["selectedMatch"]["values"]["kills"] == "51,430"
