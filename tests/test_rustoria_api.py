from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import rust_query_server_v2 as srv


def fake_rustoria_cached_get(url, headers=None, params=None, ttl=300):
    if url.endswith("/servers"):
        return [
            {
                "id": "alpha",
                "name": "Alpha",
                "leaderboardServer": True,
                "image": "https://example.com/alpha.png",
                "bannerImage": None,
                "serverType": "vanilla",
                "groupLimit": None,
                "excludeGroupRules": None,
                "gatherRate": "1",
                "region": "na",
            },
            {
                "id": "beta",
                "name": "Beta",
                "leaderboardServer": False,
                "image": "https://example.com/beta.png",
                "bannerImage": None,
                "serverType": "modded",
                "groupLimit": 4,
                "excludeGroupRules": None,
                "gatherRate": "2",
                "region": "eu",
            },
        ]

    if url.endswith("/statistics/mappings"):
        return {
            "pvp_player_kills_total": {"id": "pvp_player_kills_total", "name": "Kills", "image": None},
            "weapon_bullet_fired_total": {"id": "weapon_bullet_fired_total", "name": "Bullets Fired", "image": None},
        }

    if url.endswith("/servers/find/alpha"):
        return {
            "id": "alpha",
            "name": "Alpha",
            "leaderboardServer": True,
            "image": "alpha.png",
            "bannerImage": None,
            "serverType": "vanilla",
            "groupLimit": None,
            "excludeGroupRules": None,
            "gatherRate": "1",
            "region": "na",
            "statistics": [
                {
                    "id": "pvp",
                    "name": "PVP",
                    "composition": "@pvp_player_kills_total + @weapon_bullet_fired_total",
                    "display": "name",
                    "order": 1,
                    "default_sort": "pvp_player_kills_total",
                },
                {
                    "id": "misc",
                    "name": "Misc",
                    "composition": "@player_time_played",
                    "display": "name",
                    "order": 2,
                    "default_sort": "player_time_played",
                },
            ],
        }

    if url.endswith("/statistics/wipes/alpha"):
        return ["wipe-1", "wipe-2"]

    if "/statistics/leaderboard-totals/alpha/pvp" in url:
        return {
            "total": 999,
            "fieldTotals": {
                "kdr": "1.50",
                "accuracy": 32,
                "pvp_player_kills_total": 40,
                "weapon_bullet_fired_total": 1200,
            },
        }

    if "/statistics/leaderboards/alpha/pvp" in url:
        username = (params or {}).get("username", "")
        if username:
            return {
                "leaderboard": [
                    {
                        "rustoriaId": "player-1",
                        "username": "cactus",
                        "avatar": None,
                        "private": True,
                        "equippedCosmetics": [],
                        "total": 55,
                        "data": {
                            "pvp_player_kills_total": 22,
                            "weapon_bullet_fired_total": 400,
                            "kdr": "2.20",
                            "accuracy": 19,
                        },
                    }
                ],
                "totalItems": 1,
            }
        return {
            "leaderboard": [
                {
                    "rustoriaId": "top-1",
                    "username": "top-player",
                    "avatar": None,
                    "private": False,
                    "equippedCosmetics": [],
                    "total": 88,
                    "data": {
                        "pvp_player_kills_total": 40,
                        "weapon_bullet_fired_total": 700,
                        "kdr": "3.00",
                        "accuracy": 28,
                    },
                }
            ],
            "totalItems": 1,
        }

    if "/statistics/leaderboards/alpha/misc" in url:
        return {
            "leaderboard": [
                {
                    "rustoriaId": "player-1",
                    "username": "cactus",
                    "avatar": None,
                    "private": True,
                    "equippedCosmetics": [],
                    "total": 7200,
                    "data": {
                        "player_time_played": 7200,
                    },
                }
            ],
            "totalItems": 1,
        }

    raise AssertionError(f"Unhandled URL: {url} params={params}")


def test_extract_rustoria_composition_fields():
    composition = "@pvp_player_kills_total + @weapon_bullet_fired_total + @player_time_played"
    assert srv.extract_rustoria_composition_fields(composition) == [
        "pvp_player_kills_total",
        "weapon_bullet_fired_total",
        "player_time_played",
    ]


def test_api_rustoria_servers_filters_leaderboard_only(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "cached_get", fake_rustoria_cached_get)

    response = client.get("/api/rustoria/servers")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["count"] == 1
    assert payload["servers"][0]["id"] == "alpha"


def test_api_rustoria_server_detail_returns_statistics(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "cached_get", fake_rustoria_cached_get)

    response = client.get("/api/rustoria/servers/alpha")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["server"]["id"] == "alpha"
    assert payload["server"]["statistics"][0]["id"] == "pvp"
    assert payload["server"]["statistics"][0]["fields"][0]["name"] == "Kills"


def test_api_rustoria_leaderboard_returns_rows_fields_and_query(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "cached_get", fake_rustoria_cached_get)

    response = client.get("/api/rustoria/servers/alpha/leaderboards/pvp?from=10&orderBy=asc")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["query"]["from"] == 10
    assert payload["query"]["orderBy"] == "asc"
    assert payload["rows"][0]["rank"] == 11
    assert payload["fields"][0]["id"] == "kdr"
    assert payload["fields"][1]["id"] == "accuracy"
    assert payload["fields"][2]["id"] == "pvp_player_kills_total"


def test_api_rustoria_player_search_aggregates_statistics(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "cached_get", fake_rustoria_cached_get)

    response = client.get("/api/rustoria/player-search?serverId=alpha&username=cactus")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["identity"]["username"] == "cactus"
    assert payload["matchedStatistics"] == 2
    assert payload["statistics"][0]["selectedMatch"]["total"] == 55
    assert payload["statistics"][1]["selectedMatch"]["data"]["player_time_played"] == 7200


def test_api_rustoria_player_search_accepts_steam_id(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "cached_get", fake_rustoria_cached_get)
    monkeypatch.setattr(srv, "get_player_summary", lambda steam_id: {"steamId": steam_id, "name": "cactus"})

    response = client.get("/api/rustoria/player-search?serverId=alpha&steamId=76561198000000001")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["identity"]["username"] == "cactus"
