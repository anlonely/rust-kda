from pathlib import Path
import sys
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import rust_query_server_v2 as srv


def authenticate_client(client):
    return client


def test_resolve_steam_id_accepts_steamid64():
    assert srv.resolve_steam_id("76561198067054205") == "76561198067054205"


def test_resolve_steam_id_accepts_profile_url():
    value = "https://steamcommunity.com/profiles/76561198067054205"
    assert srv.resolve_steam_id(value) == "76561198067054205"


def test_resolve_steam_id_uses_vanity_lookup(monkeypatch):
    monkeypatch.setattr(srv, "resolve_vanity_url", lambda vanity: "76561198000000000")
    assert srv.resolve_steam_id("some-player") == "76561198000000000"


def test_resolve_vanity_url_returns_none_when_lookup_fails(monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("lookup failed")

    monkeypatch.setattr(srv, "cached_get", fail)
    assert srv.resolve_vanity_url("some-player") is None


def test_api_health_reports_defaults():
    client = srv.app.test_client()
    expected = {
        "status": "ok",
        "version": "2.0",
        "steamKeySet": srv.steam_api_key_set(),
        "bmTokenSet": srv.battlemetrics_token_set(),
        "knownDlcs": len(srv.RUST_DLCS),
        "cacheSize": len(srv._cache),
    }

    resp = client.get("/api/health")

    assert resp.status_code == 200
    assert resp.get_json() == expected


def test_api_player_returns_503_when_steam_key_missing(monkeypatch):
    client = srv.app.test_client()
    authenticate_client(client)
    monkeypatch.setattr(srv, "resolve_steam_id", lambda _: "76561198067054205")
    monkeypatch.setattr(srv, "get_player_summary", lambda _: (_ for _ in ()).throw(srv.ConfigurationError("Steam API Key 未配置")))

    resp = client.get("/api/player/demo")

    assert resp.status_code == 503
    assert resp.get_json() == {"error": "Steam API Key 未配置"}


def test_api_player_returns_404_when_id_cannot_be_resolved(monkeypatch):
    client = srv.app.test_client()
    authenticate_client(client)
    monkeypatch.setattr(srv, "resolve_steam_id", lambda _: None)

    resp = client.get("/api/player/not-a-valid-id")

    assert resp.status_code == 404
    assert resp.get_json() == {"error": "无法解析 Steam ID"}


def test_api_player_returns_mocked_player(monkeypatch):
    client = srv.app.test_client()
    authenticate_client(client)
    expected = {
        "steamId": "76561198067054205",
        "name": "Demo",
        "status": "在线",
    }
    monkeypatch.setattr(srv, "resolve_steam_id", lambda _: "76561198067054205")
    monkeypatch.setattr(srv, "get_player_summary", lambda _: expected)

    resp = client.get("/api/player/demo")

    assert resp.status_code == 200
    assert resp.get_json() == expected


def test_api_kda_rejects_invalid_id(monkeypatch):
    client = srv.app.test_client()
    authenticate_client(client)
    monkeypatch.setattr(srv, "resolve_steam_id", lambda _: None)

    resp = client.get("/api/kda/not-a-valid-id")

    assert resp.status_code == 400
    assert resp.get_json() == {"error": "无效的 Steam ID"}


def test_api_kda_returns_mocked_payload(monkeypatch):
    client = srv.app.test_client()
    authenticate_client(client)
    expected = {"summary": {"kills": 10, "deaths": 5, "kdRatio": 2.0}}
    monkeypatch.setattr(srv, "resolve_steam_id", lambda _: "76561198067054205")
    monkeypatch.setattr(srv, "get_player_kda", lambda _: expected)

    resp = client.get("/api/kda/demo")

    assert resp.status_code == 200
    assert resp.get_json() == expected


def test_get_player_kda_maps_official_rust_schema_stat_names(monkeypatch):
    payload = {
        "playerstats": {
            "stats": [
                {"name": "kill_player", "value": 25},
                {"name": "deaths", "value": 10},
                {"name": "headshots", "value": 7},
                {"name": "bullet_fired", "value": 1000},
                {"name": "bullet_hit_entity", "value": 300},
                {"name": "bullet_hit_player", "value": 120},
                {"name": "arrows_shot", "value": 90},
                {"name": "rocket_fired", "value": 8},
                {"name": "shotgun_fired", "value": 40},
                {"name": "harvest.wood", "value": 111},
                {"name": "harvest.stones", "value": 222},
                {"name": "harvest.metal_ore", "value": 333},
                {"name": "acquired_scrap", "value": 444},
                {"name": "acquired_lowgradefuel", "value": 555},
                {"name": "harvest.cloth", "value": 666},
                {"name": "harvested_leather", "value": 777},
                {"name": "placed_blocks", "value": 88},
                {"name": "upgraded_blocks", "value": 99},
                {"name": "blueprint_studied", "value": 12},
                {"name": "kill_scientist", "value": 13},
                {"name": "wounded_assisted", "value": 14},
                {"name": "wounded_healed", "value": 15},
                {"name": "death_suicide", "value": 16},
                {"name": "death_fall", "value": 17},
                {"name": "destroyed_barrels", "value": 18},
                {"name": "horse_distance_ridden_km", "value": 19},
                {"name": "missions_completed", "value": 20},
                {"name": "seconds_speaking", "value": 3600},
                {"name": "ITEM_EXAMINED", "value": 21},
                {"name": "pipes_connected", "value": 22},
                {"name": "wires_connected", "value": 23},
                {"name": "helipad_landings", "value": 24},
                {"name": "kayak_distance_travelled", "value": 25},
                {"name": "scope_zoom_changed", "value": 26},
                {"name": "mlrs_kills", "value": 27},
                {"name": "bee_attacks_count", "value": 28},
                {"name": "tincanalarms_wired", "value": 29},
            ]
        }
    }
    monkeypatch.setattr(srv, "steam_api_key_set", lambda: True)
    monkeypatch.setattr(srv, "cached_get", lambda *args, **kwargs: payload)

    result = srv.get_player_kda("76561198067054205")

    assert result["summary"]["headshots"] == 7
    assert result["summary"]["headshotRate"] == 5.83
    assert result["summary"]["accuracy"] == 12.0
    assert result["summary"]["bulletsHit"] == 300
    assert result["summary"]["shotgunFired"] == 40
    assert result["resources"]["wood"] == 111
    assert result["resources"]["metalOre"] == 333
    assert result["resources"]["scrap"] == 444
    assert result["medical"]["assisted"] == 14
    assert result["deaths"]["suicide"] == 16
    assert result["building"]["placed"] == 88
    assert result["otherStats"]["missionsCompleted"] == 20
    assert result["otherStats"]["voiceChatTime"] == 3600
    assert result["otherStats"]["tinCanAlarmsWired"] == 29
    assert any(section["id"] == "resources" for section in result["sections"])
    assert any(section["id"] == "other" for section in result["sections"])


def test_api_inventory_returns_mocked_payload(monkeypatch):
    client = srv.app.test_client()
    authenticate_client(client)
    expected = {
        "skins": [],
        "dlcs": [],
        "skinsSummary": {"totalItems": 0},
        "dlcSummary": {"totalDlcs": 0},
        "totalSummary": {"totalValue": 0},
    }
    monkeypatch.setattr(srv, "resolve_steam_id", lambda _: "76561198067054205")
    monkeypatch.setattr(srv, "get_player_inventory_with_dlc", lambda _: expected)

    resp = client.get("/api/inventory/demo")

    assert resp.status_code == 200
    assert resp.get_json() == expected


def test_api_server_search_requires_query():
    client = srv.app.test_client()
    authenticate_client(client)

    resp = client.get("/api/servers/search")

    assert resp.status_code == 400
    assert resp.get_json() == {"error": "请提供搜索关键词"}


def test_search_bm_player_uses_supported_query_params(monkeypatch):
    captured = {}

    def fake_cached_get(url, headers=None, params=None, ttl=300):
        captured["url"] = url
        captured["headers"] = headers
        captured["params"] = params
        return {"data": [{"id": "42", "attributes": {"name": "Demo", "lastSeen": "2026-04-03T00:00:00Z"}}]}

    monkeypatch.setattr(srv, "battlemetrics_token_set", lambda: True)
    monkeypatch.setattr(srv, "cached_get", fake_cached_get)

    result = srv.search_bm_player("Sullivan")

    assert captured["url"] == "https://api.battlemetrics.com/players"
    assert captured["params"] == {"filter[search]": "Sullivan", "page[size]": 10}
    assert result == [{"bmId": "42", "name": "Demo", "lastSeen": "2026-04-03T00:00:00Z"}]


def test_resolve_bm_player_id_accepts_battlemetrics_id_directly():
    assert srv.resolve_bm_player_id("12345") == "12345"


def test_resolve_bm_player_id_uses_steam_name_search(monkeypatch):
    monkeypatch.setattr(srv, "resolve_steam_id", lambda _: "76561198067054205")
    monkeypatch.setattr(srv, "get_player_summary", lambda _: {"name": "Demo"})
    calls = []

    def fake_search(query):
        calls.append(query)
        if query == "Demo":
            return [{"bmId": "42", "name": "Demo", "lastSeen": "2026-04-03T00:00:00Z"}]
        return []

    monkeypatch.setattr(srv, "search_bm_player", fake_search)
    monkeypatch.setattr(srv, "get_bm_session_preview", lambda bm_id: {"count": 0, "hasMore": False})

    assert srv.resolve_bm_player_id("76561198067054205") == "42"
    assert calls == ["Demo", "demo"]


def test_find_bm_candidates_for_player_ref_returns_ranked_candidates(monkeypatch):
    monkeypatch.setattr(srv, "resolve_steam_id", lambda _: "76561198067054205")
    monkeypatch.setattr(srv, "get_player_summary", lambda _: {"name": "Demo"})

    def fake_search(query):
        if query == "Demo":
            return [
                {"bmId": "42", "name": "Demo", "lastSeen": "2026-04-03T00:00:00Z"},
                {"bmId": "99", "name": "Demo Alt", "lastSeen": None},
            ]
        if query == "demo":
            return [{"bmId": "42", "name": "Demo", "lastSeen": "2026-04-03T00:00:00Z"}]
        return []

    monkeypatch.setattr(srv, "search_bm_player", fake_search)
    monkeypatch.setattr(srv, "get_bm_session_preview", lambda bm_id: {
        "42": {"count": 3, "hasMore": False},
        "99": {"count": 0, "hasMore": False},
    }[bm_id])

    result = srv.find_bm_candidates_for_player_ref("76561198067054205")

    assert result["steamId"] == "76561198067054205"
    assert result["playerName"] == "Demo"
    assert [candidate["bmId"] for candidate in result["candidates"]] == ["42", "99"]
    assert result["candidates"][0]["sessionPreview"]["count"] == 3


def test_get_player_inventory_with_dlc_handles_private_inventory(monkeypatch):
    def raise_inventory(*args, **kwargs):
        response = type("Resp", (), {"status_code": 400})()
        err = requests.exceptions.HTTPError("bad request")
        err.response = response
        raise err

    monkeypatch.setattr(srv, "cached_get", raise_inventory)
    monkeypatch.setattr(srv, "fetch_rust_dlc_list", lambda: [])
    monkeypatch.setattr(srv, "fetch_rust_itemstore_catalog", lambda: [])

    result = srv.get_player_inventory_with_dlc("76561198067054205")

    assert result["inventoryAvailable"] is False
    assert result["skinsSummary"]["available"] is False
    assert result["skinsSummary"]["totalValue"] is None
    assert result["totalSummary"]["totalValue"] is None


def test_get_inventory_item_price_prefers_scmm(monkeypatch):
    monkeypatch.setattr(srv, "fetch_scmm_price", lambda name, currency="USD", ttl=1800: {
        "price": 12.72,
        "source": "scmm",
        "market": "SteamCommunityMarket",
        "itemId": 123,
        "url": "/api/partner/buy",
    })
    monkeypatch.setattr(srv, "fetch_steam_market_price", lambda name, ttl=1800: {
        "price": 9.99,
        "source": "steam-market",
        "market": "SteamCommunityMarket",
        "itemId": None,
        "url": None,
    })

    result = srv.get_inventory_item_price("Tempered AK47")

    assert result["price"] == 12.72
    assert result["source"] == "scmm"


def test_get_inventory_item_price_falls_back_to_steam_market(monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("scmm down")

    monkeypatch.setattr(srv, "fetch_scmm_price", fail)
    monkeypatch.setattr(srv, "fetch_steam_market_price", lambda name, ttl=1800: {
        "price": 9.99,
        "source": "steam-market",
        "market": "SteamCommunityMarket",
        "itemId": None,
        "url": None,
    })

    result = srv.get_inventory_item_price("Tempered AK47")

    assert result["price"] == 9.99
    assert result["source"] == "steam-market"


def test_get_player_inventory_with_dlc_uses_scmm_profile_inventory(monkeypatch):
    monkeypatch.setattr(srv, "fetch_scmm_profile_inventory_value", lambda steam_id: {
        "steamId": steam_id,
        "items": 204,
        "marketValue": 28816,
    })
    monkeypatch.setattr(srv, "fetch_scmm_profile_inventory_items", lambda steam_id: [{
        "id": 1,
        "name": "No Mercy Jacket",
        "itemType": "Jacket",
        "quantity": 2,
        "buyNowFrom": "SteamCommunityMarket",
        "buyNowPrice": 3818,
        "totalBuyNowPrice": 7636,
        "originalPrice": 249,
        "iconUrl": "https://example.com/item.png",
        "stacks": [{"steamId": "123", "quantity": 2, "tradableAndMarketable": True}],
    }])
    monkeypatch.setattr(srv, "fetch_rust_inventory", lambda steam_id, lang="schinese": (None, "private"))
    monkeypatch.setattr(srv, "fetch_rust_dlc_list", lambda: [])
    monkeypatch.setattr(srv, "fetch_rust_itemstore_catalog", lambda: [])

    result = srv.get_player_inventory_with_dlc("76561199886302710")

    assert result["inventoryAvailable"] is True
    assert result["skinsSummary"]["source"] == "scmm-profile"
    assert result["skinsSummary"]["totalItems"] == 204
    assert result["skinsSummary"]["distinctItems"] == 1
    assert result["skinsSummary"]["totalValue"] == 288.16
    assert result["skins"][0]["price"] == 76.36
    assert result["skins"][0]["quantity"] == 2


def test_fetch_rust_inventory_paginates_steam_web_inventory(monkeypatch):
    calls = []

    def fake_cached_get(url, headers=None, params=None, ttl=300):
        calls.append(params)
        if "start_assetid" not in params:
            return {
                "success": 1,
                "total_inventory_count": 2,
                "more_items": 1,
                "last_assetid": "111",
                "assets": [{"assetid": "111", "classid": "1", "instanceid": "0", "amount": "1"}],
                "descriptions": [{"classid": "1", "instanceid": "0", "name": "Jungle Pack"}],
            }
        return {
            "success": 1,
            "more_items": 0,
            "last_assetid": "222",
            "assets": [{"assetid": "222", "classid": "2", "instanceid": "0", "amount": "1"}],
            "descriptions": [{"classid": "2", "instanceid": "0", "name": "Medieval Pack"}],
        }

    monkeypatch.setattr(srv, "cached_get", fake_cached_get)

    result, error = srv.fetch_rust_inventory("76561199886302710")

    assert error is None
    assert result["total_inventory_count"] == 2
    assert len(result["assets"]) == 2
    assert len(result["descriptions"]) == 2
    assert calls[0]["count"] == 75
    assert calls[1]["count"] == 2500
    assert calls[1]["start_assetid"] == "111"


def test_fetch_rust_itemstore_catalog_parses_current_store_items(monkeypatch):
    html = """
    <div class="item_def_grid_item ">
        <div><div class="item_def_name ellipsis"><a href="https://store.steampowered.com/itemstore/252490/detail/10222/">Abyss Pack</a></div>
        <div class="item_def_price">$12.99</div></div>
    </div>
    <div class="item_def_grid_item ">
        <div><div class="item_def_name ellipsis"><a href="https://store.steampowered.com/itemstore/252490/detail/10435/">Storage Box Pack</a></div>
        <div class="item_def_price">$17.99</div></div>
    </div>
    """

    monkeypatch.setattr(srv, "cached_get", lambda url, headers=None, params=None, ttl=300: {
        "total_count": 2,
        "results_html": html,
    })

    items = srv.fetch_rust_itemstore_catalog()

    assert len(items) == 2
    assert items[0]["name"] == "Abyss Pack"
    assert items[0]["nameCN"] == "深渊包"
    assert items[0]["category"] == "扩展包"
    assert items[0]["priceValue"] == 12.99
    assert items[1]["nameCN"] == "储物箱包"
    assert items[1]["detailId"] == "10435"


def test_get_player_inventory_with_dlc_merges_steam_web_inventory_and_scmm(monkeypatch):
    monkeypatch.setattr(srv, "fetch_scmm_profile_inventory_value", lambda steam_id: {
        "steamId": steam_id,
        "items": 3,
        "marketValue": 7636,
    })
    monkeypatch.setattr(srv, "fetch_scmm_profile_inventory_items", lambda steam_id: [{
        "id": 1,
        "name": "No Mercy Jacket",
        "itemType": "Jacket",
        "quantity": 2,
        "buyNowFrom": "SteamCommunityMarket",
        "buyNowPrice": 3818,
        "totalBuyNowPrice": 7636,
        "stacks": [{"steamId": steam_id, "quantity": 2, "tradableAndMarketable": True}],
    }])
    monkeypatch.setattr(srv, "fetch_rust_inventory", lambda steam_id, lang="schinese": ({
        "total_inventory_count": 3,
        "assets": [
            {"assetid": "111", "classid": "1", "instanceid": "0", "amount": "2"},
            {"assetid": "222", "classid": "2", "instanceid": "0", "amount": "1"},
        ],
        "descriptions": [
            {
                "classid": "1",
                "instanceid": "0",
                "name": "No Mercy Jacket",
                "market_hash_name": "No Mercy Jacket",
                "market_name": "No Mercy Jacket",
                "tradable": 1,
                "marketable": 1,
                "icon_url": "icon-1",
                "tags": [{"category": "Type", "localized_tag_name": "Jacket"}],
            },
            {
                "classid": "2",
                "instanceid": "0",
                "name": "Jungle Pack",
                "market_hash_name": "Jungle Pack",
                "market_name": "Jungle Pack",
                "tradable": 0,
                "marketable": 0,
                "icon_url": "icon-2",
                "tags": [],
            },
        ],
    }, None))
    monkeypatch.setattr(srv, "fetch_rust_itemstore_catalog", lambda: [
        {
            "detailId": "10273",
            "name": "Jungle Pack",
            "nameCN": "丛林包",
            "category": "扩展包",
            "priceText": "$12.99",
            "priceValue": 12.99,
            "storeUrl": "https://store.steampowered.com/itemstore/252490/detail/10273/",
            "source": "steam-itemstore",
        },
        {
            "detailId": "10435",
            "name": "Storage Box Pack",
            "nameCN": "储物箱包",
            "category": "扩展包",
            "priceText": "$17.99",
            "priceValue": 17.99,
            "storeUrl": "https://store.steampowered.com/itemstore/252490/detail/10435/",
            "source": "steam-itemstore",
        },
    ])
    monkeypatch.setattr(srv, "fetch_rust_dlc_list", lambda: [])

    result = srv.get_player_inventory_with_dlc("76561199886302710")

    assert result["inventoryAvailable"] is True
    assert result["skinsSummary"]["source"] == "steam-web+scmm"
    assert result["skinsSummary"]["totalItems"] == 3
    assert result["skinsSummary"]["distinctItems"] == 2
    assert result["skinsSummary"]["steamWebOnlyDistinct"] == 1
    assert result["skinsSummary"]["pricedByScmmDistinct"] == 1
    assert result["totalSummary"]["totalValue"] == 76.36
    assert result["storeSummary"]["ownedCount"] == 1
    assert result["storeSummary"]["steamWebOnlyCount"] == 2
    assert result["storeSummary"]["ownedValue"] == 12.99
    assert result["totalSummary"]["ownedStoreValue"] == 12.99

    by_name = {item["name"]: item for item in result["skins"]}
    assert by_name["No Mercy Jacket"]["quantity"] == 2
    assert by_name["No Mercy Jacket"]["price"] == 76.36
    assert by_name["No Mercy Jacket"]["source"] == "steam-web+scmm"
    assert by_name["Jungle Pack"]["nameCN"] == "丛林包"
    assert by_name["Jungle Pack"]["source"] == "steam-web"
    assert any(item["name"] == "Jungle Pack" and item["owned"] is True for item in result["storeCatalog"])


def test_resolve_bm_player_id_prefers_candidate_with_sessions(monkeypatch):
    monkeypatch.setattr(srv, "resolve_steam_id", lambda _: "76561199886302710")
    monkeypatch.setattr(srv, "get_player_summary", lambda _: {"name": "A1-ANJING"})

    def fake_search(query):
        if query == "A1-ANJING":
            return [
                {"bmId": "976944988", "name": "anjing anjing anjing", "lastSeen": None},
                {"bmId": "909738004", "name": "ANJING ANJING ANJING", "lastSeen": None},
            ]
        if query == "a1 anjing":
            return [{"bmId": "741315275", "name": "Anjing", "lastSeen": None}]
        return []

    monkeypatch.setattr(srv, "search_bm_player", fake_search)
    monkeypatch.setattr(srv, "get_bm_session_preview", lambda bm_id: {
        "976944988": {"count": 0, "hasMore": False},
        "909738004": {"count": 0, "hasMore": False},
        "741315275": {"count": 1, "hasMore": False},
    }[bm_id])

    assert srv.resolve_bm_player_id("76561199886302710") == "741315275"


def test_api_servers_returns_404_when_player_cannot_be_resolved(monkeypatch):
    client = srv.app.test_client()
    authenticate_client(client)
    monkeypatch.setattr(srv, "resolve_bm_player_id", lambda _: None)

    resp = client.get("/api/servers/76561198067054205")

    assert resp.status_code == 404
    assert resp.get_json() == {"error": "找不到对应的 BattleMetrics 玩家"}


def test_api_servers_returns_mocked_payload(monkeypatch):
    client = srv.app.test_client()
    authenticate_client(client)
    expected = {"servers": [], "summary": {"totalHours": 0, "serverCount": 0}}
    monkeypatch.setattr(srv, "resolve_bm_player_id", lambda _: "12345")
    monkeypatch.setattr(srv, "get_player_servers", lambda _: expected)

    resp = client.get("/api/servers/76561198067054205")

    assert resp.status_code == 200
    assert resp.get_json() == {**expected, "bmId": "12345", "selectionMode": "auto"}


def test_api_server_candidates_returns_mocked_payload(monkeypatch):
    client = srv.app.test_client()
    authenticate_client(client)
    expected = {
        "steamId": "76561199886302710",
        "playerName": "A1-ANJING",
        "candidates": [{"bmId": "741315275", "name": "Anjing"}],
    }
    monkeypatch.setattr(srv, "find_bm_candidates_for_player_ref", lambda _: expected)

    resp = client.get("/api/servers/candidates/76561199886302710")

    assert resp.status_code == 200
    assert resp.get_json() == expected


def test_api_servers_uses_explicit_bmid_when_provided(monkeypatch):
    client = srv.app.test_client()
    authenticate_client(client)
    expected = {"servers": [], "summary": {"totalHours": 0, "serverCount": 0}}
    monkeypatch.setattr(srv, "resolve_bm_player_id", lambda _: "wrong")
    monkeypatch.setattr(srv, "get_player_servers", lambda bm_id: {**expected, "checkedBmId": bm_id})

    resp = client.get("/api/servers/76561199886302710?bmId=741315275")

    assert resp.status_code == 200
    assert resp.get_json() == {
        **expected,
        "checkedBmId": "741315275",
        "bmId": "741315275",
        "selectionMode": "explicit",
    }


def test_api_no_longer_rejects_requests_without_auth():
    client = srv.app.test_client()
    srv._rate_limit_bucket.clear()
    original_limit = srv.API_RATE_LIMIT_PER_MINUTE
    srv.API_RATE_LIMIT_PER_MINUTE = 60

    try:
        resp = client.get("/api/player/demo")
    finally:
        srv.API_RATE_LIMIT_PER_MINUTE = original_limit

    assert resp.status_code != 401


def test_api_auth_login_is_now_a_noop():
    client = srv.app.test_client()
    resp = client.post("/api/auth/login", json={"password": "anything"})

    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True, "authenticated": True}


def test_api_auth_logout_is_now_a_noop():
    client = srv.app.test_client()
    resp = client.post("/api/auth/logout")

    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True, "authenticated": True}


def test_api_rate_limit_returns_429(monkeypatch):
    client = srv.app.test_client()
    authenticate_client(client)
    srv._rate_limit_bucket.clear()
    monkeypatch.setattr(srv, "API_RATE_LIMIT_PER_MINUTE", 1)
    monkeypatch.setattr(srv, "resolve_steam_id", lambda _: "76561198067054205")
    monkeypatch.setattr(srv, "get_player_summary", lambda _: {"steamId": "76561198067054205", "name": "Demo"})

    first = client.get("/api/player/demo")
    second = client.get("/api/player/demo")

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.get_json() == {"error": "请求过于频繁，请稍后再试"}
