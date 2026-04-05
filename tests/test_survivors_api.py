from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import rust_query_server_v2 as srv


FAKE_SURVIVORS_CATALOG = {
    "source": "https://survivors.gg/#leaderboards",
    "servers": [
        {"id": "srv-7", "name": "Survivors.gg #7", "active": True},
        {"id": "monthly", "name": "Survivors.gg Monthly", "active": False},
    ],
    "categories": [
        {"id": "overall", "name": "OVERALL", "active": True},
        {"id": "pvp", "name": "PVP", "active": False},
    ],
}


def fake_fetch_survivors_catalog():
    return FAKE_SURVIVORS_CATALOG


def fake_fetch_survivors_server_detail(server_id):
    server = next(item for item in FAKE_SURVIVORS_CATALOG["servers"] if item["id"] == server_id)
    return {
        "server": {**server, "active": True},
        "periods": [
            {"id": "wipe", "name": "Current Wipe", "active": True},
            {"id": "lifetime", "name": "Lifetime", "active": False},
        ],
        "categories": FAKE_SURVIVORS_CATALOG["categories"],
    }


def fake_fetch_survivors_leaderboard(server_id, category_id, period_value="wipe", search="", page_number=1):
    return {
        "server": {"id": server_id, "name": "Survivors.gg #7", "active": True},
        "category": next(item for item in FAKE_SURVIVORS_CATALOG["categories"] if item["id"] == category_id),
        "period": {"id": period_value or "wipe", "name": "Current Wipe", "active": True},
        "fields": [
            {"id": "time_played", "name": "Time Played", "kind": "duration"},
            {"id": "rating_total", "name": "Total Rating", "kind": "number"},
        ],
        "rows": [
            {
                "rank": 1,
                "playerName": "322",
                "steamId": "76561199858388683",
                "avatar": "https://avatars.steamstatic.com/hash_full.jpg",
                "values": {"time_played": 2830, "rating_total": 2038},
                "stats": {"time_played": 2830, "rating_total": 2038},
            }
        ],
        "total": 952,
        "query": {
            "serverId": server_id,
            "categoryId": category_id,
            "period": period_value or "wipe",
            "search": search,
            "page": page_number,
        },
    }


def fake_fetch_survivors_player_summary(server_id, username, period_value="wipe"):
    return {
        "server": {"id": server_id, "name": "Survivors.gg #7", "active": True},
        "period": {"id": period_value or "wipe", "name": "Current Wipe", "active": True},
        "identity": {
            "playerName": "322",
            "avatar": "https://avatars.steamstatic.com/hash_full.jpg",
            "steamId": "76561199858388683",
        },
        "categories": [
            {
                "category": {"id": "overall", "name": "OVERALL", "active": True},
                "fields": [
                    {"id": "time_played", "name": "Time Played", "kind": "duration"},
                    {"id": "rating_total", "name": "Total Rating", "kind": "number"},
                ],
                "matchCount": 1,
                "exactMatchCount": 1,
                "selectedMatch": {
                    "rank": 1,
                    "playerName": username,
                    "steamId": "76561199858388683",
                    "avatar": "https://avatars.steamstatic.com/hash_full.jpg",
                    "values": {"time_played": 2830, "rating_total": 2038},
                    "stats": {"time_played": 2830, "rating_total": 2038},
                },
                "matches": [],
            },
            {
                "category": {"id": "pvp", "name": "PVP", "active": False},
                "fields": [{"id": "kills", "name": "Kills", "kind": "number"}],
                "matchCount": 1,
                "exactMatchCount": 1,
                "selectedMatch": {
                    "rank": 1,
                    "playerName": username,
                    "steamId": "76561199858388683",
                    "avatar": "https://avatars.steamstatic.com/hash_full.jpg",
                    "values": {"kills": 15},
                    "stats": {"kills": 15},
                },
                "matches": [],
            },
        ],
        "matchedCategories": 2,
    }


def test_api_survivors_servers_returns_catalog(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "fetch_survivors_catalog", fake_fetch_survivors_catalog)

    response = client.get("/api/survivors/servers")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["count"] == 2
    assert payload["servers"][0]["id"] == "srv-7"
    assert payload["categories"][0]["id"] == "overall"


def test_api_survivors_server_detail_returns_periods(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "fetch_survivors_server_detail", fake_fetch_survivors_server_detail)

    response = client.get("/api/survivors/servers/srv-7")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["server"]["id"] == "srv-7"
    assert payload["periods"][1]["id"] == "lifetime"


def test_api_survivors_leaderboard_returns_rows_and_query(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "fetch_survivors_leaderboard", fake_fetch_survivors_leaderboard)

    response = client.get("/api/survivors/servers/srv-7/leaderboards/overall?search=322&page=2&period=lifetime")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["rows"][0]["playerName"] == "322"
    assert payload["query"]["search"] == "322"
    assert payload["query"]["page"] == 2
    assert payload["query"]["period"] == "lifetime"


def test_api_survivors_player_search_returns_category_matches(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "fetch_survivors_player_summary", fake_fetch_survivors_player_summary)

    response = client.get("/api/survivors/player-search?serverId=srv-7&username=322")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["identity"]["steamId"] == "76561199858388683"
    assert payload["matchedCategories"] == 2
    assert payload["categories"][1]["selectedMatch"]["values"]["kills"] == 15


def test_api_survivors_player_search_accepts_steam_id(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "fetch_survivors_player_summary", fake_fetch_survivors_player_summary)
    monkeypatch.setattr(srv, "get_player_summary", lambda steam_id: {"steamId": steam_id, "name": "322"})

    response = client.get("/api/survivors/player-search?serverId=srv-7&steamId=76561199858388683")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["identity"]["steamId"] == "76561199858388683"
