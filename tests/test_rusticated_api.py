from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import rust_query_server_v2 as srv


def fake_rusticated_cached_get(url, headers=None, params=None, ttl=300):
    if url.endswith("/v2/servers"):
        return {
            "success": True,
            "data": [
                {
                    "id": "main",
                    "name": "Main",
                    "title": "Rusticated.com - US Main",
                    "host": "us-main.rusticated.com",
                    "port": 28010,
                    "online": True,
                    "timezone": "America/New_York",
                    "maxTeamSize": "16",
                    "nextWipe": "2026-04-09T19:00:00.000Z",
                    "nextForcedWipe": "2026-05-07T18:00:00.000Z",
                    "spot": 2,
                    "population": {"players": 50, "maxPlayers": 150, "queued": 0, "joining": 0},
                    "map": {"name": "Procedural Map", "worldSize": 4255, "seed": 864329006},
                    "lastEvents": {"wipe": "2026-04-02T17:44:37.000Z"},
                },
                {
                    "id": "EUMain",
                    "name": "EU Main",
                    "title": "Rusticated.com - EU Main",
                    "host": "eu-main.rusticated.com",
                    "port": 28010,
                    "online": True,
                    "timezone": "Europe/Paris",
                    "maxTeamSize": "16",
                    "nextWipe": "2026-04-09T13:00:00.000Z",
                    "nextForcedWipe": "2026-05-07T18:00:00.000Z",
                    "spot": 1,
                    "population": {"players": 64, "maxPlayers": 150, "queued": 0, "joining": 1},
                    "map": {"name": "Procedural Map", "worldSize": 4555, "seed": 1306696667},
                    "lastEvents": {"wipe": "2026-04-02T17:43:15.000Z"},
                },
            ],
        }

    if url.endswith("/v3/server-wipes"):
        return {
            "success": True,
            "data": [
                {
                    "id": 4563,
                    "serverId": "main",
                    "startedAt": "2026-04-02T17:44:37.000Z",
                    "endedAt": None,
                    "mapId": 1,
                    "mapSize": 4255,
                    "mapImageUrl": "https://example.com/map.png",
                    "mapRustMapsId": "map-1",
                    "mapRustMapsUrl": "https://rustmaps.com/map/map-1",
                },
                {
                    "id": 4562,
                    "serverId": "main",
                    "startedAt": "2026-03-27T17:44:37.000Z",
                    "endedAt": "2026-04-02T17:44:37.000Z",
                    "mapId": 2,
                    "mapSize": 4255,
                    "mapImageUrl": "https://example.com/map2.png",
                    "mapRustMapsId": "map-2",
                    "mapRustMapsUrl": "https://rustmaps.com/map/map-2",
                },
            ],
        }

    if url.endswith("/v3/leaderboard/stat-groups"):
        return {
            "success": True,
            "data": [
                {
                    "id": "pvp",
                    "name": "PvP",
                    "sortOrder": 0,
                    "statTypes": [
                        {"id": "kill_player", "name": "Kills", "group": "pvp", "sortOrder": 1},
                        {"id": "death_player", "name": "Deaths", "group": "pvp", "sortOrder": 2},
                        {"id": "kdr", "name": "KDR", "group": "pvp", "sortOrder": 3},
                        {"id": "playtime", "name": "Playtime", "group": "pvp", "sortOrder": 4},
                    ],
                },
                {
                    "id": "gathered-resources",
                    "name": "Gathered Resources",
                    "sortOrder": 1,
                    "statTypes": [
                        {"id": "gathered_wood", "name": "Wood", "group": "gathered-resources", "sortOrder": 1},
                        {"id": "gathered_stones", "name": "Stone", "group": "gathered-resources", "sortOrder": 2},
                    ],
                },
            ],
        }

    if url.endswith("/v3/leaderboard"):
        group = (params or {}).get("group")
        filter_value = (params or {}).get("filter", "")
        if group == "pvp":
            if filter_value:
                return {
                    "success": True,
                    "data": {
                        "total": 1,
                        "entries": [
                            {
                                "rank": 2,
                                "steamId": "76561198000000001",
                                "username": "Ignignokt",
                                "avatarUrl": "https://example.com/avatar.png",
                                "stats": {
                                    "kill_player": 144,
                                    "death_player": 84,
                                    "kdr": 1.71,
                                    "playtime": 115928,
                                },
                            }
                        ],
                        "userEntry": None,
                    },
                }
            return {
                "success": True,
                "data": {
                    "total": 100,
                    "entries": [
                        {
                            "rank": 1,
                            "steamId": "76561198000000002",
                            "username": "TopPlayer",
                            "avatarUrl": "https://example.com/top.png",
                            "stats": {
                                "kill_player": 10210,
                                "death_player": 5156,
                                "kdr": 1.98,
                                "playtime": 4834943,
                            },
                        }
                    ],
                    "userEntry": None,
                },
            }

        if group == "gathered-resources":
            return {
                "success": True,
                "data": {
                    "total": 1,
                    "entries": [
                        {
                            "rank": 7,
                            "steamId": "76561198000000001",
                            "username": "Ignignokt",
                            "avatarUrl": "https://example.com/avatar.png",
                            "stats": {
                                "gathered_wood": 5000,
                                "gathered_stones": 2000,
                            },
                        }
                    ],
                    "userEntry": None,
                },
            }

    raise AssertionError(f"Unhandled URL: {url} params={params}")


def test_api_rusticated_servers_returns_servers_and_groups(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "cached_get", fake_rusticated_cached_get)

    response = client.get("/api/rusticated/servers")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["count"] == 2
    assert payload["servers"][0]["id"] == "EUMain"
    assert payload["groups"][0]["id"] == "pvp"


def test_api_rusticated_server_detail_returns_wipes(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "cached_get", fake_rusticated_cached_get)

    response = client.get("/api/rusticated/servers/main")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["server"]["id"] == "main"
    assert payload["defaultWipeId"] == 4563
    assert payload["wipes"][0]["id"] == 4563


def test_api_rusticated_leaderboard_returns_rows(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "cached_get", fake_rusticated_cached_get)

    response = client.get("/api/rusticated/servers/main/leaderboards/pvp?sortBy=kill_player&sortDir=desc&offset=10")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["group"]["id"] == "pvp"
    assert payload["rows"][0]["username"] == "TopPlayer"
    assert payload["query"]["offset"] == 10
    assert payload["query"]["serverWipeId"] == 4563


def test_api_rusticated_player_search_returns_group_matches(monkeypatch):
    client = srv.app.test_client()
    monkeypatch.setattr(srv, "cached_get", fake_rusticated_cached_get)

    response = client.get("/api/rusticated/player-search?serverId=main&username=Ignignokt")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["identity"]["username"] == "Ignignokt"
    assert payload["matchedGroups"] == 2
    assert payload["groups"][0]["selectedMatch"]["stats"]["kill_player"] == 144
