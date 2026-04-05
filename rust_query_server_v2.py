"""
Rust 玩家查询工具 - 后端 API 代理服务器 v2
============================================
新增: DLC 扩展包检测与库存合并显示
"""

import json
import time
import hashlib
import re
import os
from html import unescape
from pathlib import Path
from contextlib import contextmanager
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from datetime import datetime
try:
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright
except Exception:
    PlaywrightTimeoutError = RuntimeError
    sync_playwright = None


def load_dotenv():
    env_path = Path(__file__).resolve().with_name(".env")
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


load_dotenv()

# ╔══════════════════════════════════════════════════════════╗
# ║  🔑  在此填入你的 API Key                               ║
# ╚══════════════════════════════════════════════════════════╝
DEFAULT_STEAM_API_KEY = "YOUR_STEAM_API_KEY"
DEFAULT_BATTLEMETRICS_TOKEN = "YOUR_BM_TOKEN"
DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
STEAM_API_KEY = os.getenv("STEAM_API_KEY", DEFAULT_STEAM_API_KEY)
BATTLEMETRICS_TOKEN = os.getenv("BATTLEMETRICS_TOKEN", DEFAULT_BATTLEMETRICS_TOKEN)
API_RATE_LIMIT_PER_MINUTE = int(os.getenv("API_RATE_LIMIT_PER_MINUTE", "60"))
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS).split(",")
    if origin.strip()
]

RUST_APPID = 252490
SCMM_BASE_URL = "https://rust.scmm.app/api"
STEAM_ITEMSTORE_URL = f"https://store.steampowered.com/itemstore/{RUST_APPID}/ajaxgetitemdefs/"
RUSTORIA_API_BASE = "https://api.rustoria.co"
RUSTORIA_CACHE_TTL = 180
RUSTORIA_MAPPING_TTL = 1800
RUSTORIA_SERVER_TTL = 600
RUSTORIA_COMPOSITION_RE = re.compile(r"@([a-z0-9_]+)")
RUSTORIA_SPECIAL_FIELD_NAMES = {
    "kdr": "KDR",
    "accuracy": "Accuracy",
    "total": "Total",
}
RUSTORIA_PERCENT_FIELDS = {"accuracy"}
RUSTORIA_RATIO_FIELDS = {"kdr"}
RUSTORIA_DURATION_FIELDS = {"player_time_played", "player_time_swimming"}
RUSTICATED_API_BASE = "https://rusticated.com/api"
RUSTICATED_ORG_ID = "1"
RUSTICATED_CACHE_TTL = 180
RUSTICATED_META_TTL = 1800
MOOSE_STATS_URL = "https://moose.gg/stats"
MOOSE_CACHE_TTL = 180
MOOSE_META_TTL = 1800
MOOSE_INTERACTION_DELAY_MS = 1200
MOOSE_BOOT_DELAY_MS = 1200
SURVIVORS_URL = "https://survivors.gg/#leaderboards"
SURVIVORS_API_BASE = "https://integration.rankeval.gg/apis/public"
SURVIVORS_CACHE_TTL = 180
SURVIVORS_META_TTL = 1800
SURVIVORS_INTERACTION_DELAY_MS = 1400
SURVIVORS_BOOT_DELAY_MS = 2500
SURVIVORS_CATALOG_TIMEOUT_MS = 15000
SURVIVORS_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)
ATLAS_PLAYER_LOOKUP_URL = "https://atlasrust.com/player-lookup"
ATLAS_API_PUBLIC_BASE = "https://services.atlasrust.com/api/public"
ATLAS_CACHE_TTL = 180
ATLAS_META_TTL = 1800
ATLAS_INTERACTION_DELAY_MS = 1200

# ── 简易内存缓存 ──
_cache = {}
_bm_resolution_cache = {}
_rate_limit_bucket = {}

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})


class ConfigurationError(RuntimeError):
    pass


def steam_api_key_set():
    return STEAM_API_KEY != DEFAULT_STEAM_API_KEY


def battlemetrics_token_set():
    return BATTLEMETRICS_TOKEN != DEFAULT_BATTLEMETRICS_TOKEN


def get_client_ip():
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.remote_addr or "unknown"


def check_rate_limit(bucket_name, limit, window_seconds=60):
    now = time.time()
    bucket_key = f"{bucket_name}:{get_client_ip()}"
    bucket = _rate_limit_bucket.get(bucket_key)
    if not bucket or now - bucket["windowStart"] >= window_seconds:
        bucket = {"count": 0, "windowStart": now}
        _rate_limit_bucket[bucket_key] = bucket
    if bucket["count"] >= limit:
        retry_after = max(1, int(window_seconds - (now - bucket["windowStart"])))
        return False, retry_after
    bucket["count"] += 1
    return True, 0


@app.before_request
def protect_api_routes():
    if not request.path.startswith("/api/"):
        return None

    if request.path == "/api/health":
        return None

    allowed, retry_after = check_rate_limit("api", API_RATE_LIMIT_PER_MINUTE)
    if not allowed:
        response = jsonify({"error": "请求过于频繁，请稍后再试"})
        response.status_code = 429
        response.headers["Retry-After"] = str(retry_after)
        return response

    return None

def cached_get(url, headers=None, params=None, ttl=300):
    cache_key = hashlib.md5(f"{url}{json.dumps(params, sort_keys=True) if params else ''}".encode()).hexdigest()
    now = time.time()
    if cache_key in _cache and now - _cache[cache_key]["ts"] < ttl:
        return _cache[cache_key]["data"]
    last_error = None
    for attempt in range(3):
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            _cache[cache_key] = {"data": data, "ts": now}
            return data
        except (requests.exceptions.SSLError, requests.exceptions.ConnectionError, requests.exceptions.ReadTimeout) as e:
            last_error = e
            if attempt == 2:
                raise
            time.sleep(0.4 * (attempt + 1))
        except Exception:
            raise
    raise last_error


def cached_compute(cache_key, ttl, builder):
    now = time.time()
    if cache_key in _cache and now - _cache[cache_key]["ts"] < ttl:
        return _cache[cache_key]["data"]
    data = builder()
    _cache[cache_key] = {"data": data, "ts": now}
    return data


def fetch_scmm_price(item_name, currency="USD", ttl=1800):
    if not item_name:
        return None

    data = cached_get(
        f"{SCMM_BASE_URL}/item",
        headers={"Currency": currency},
        params={"filter": item_name, "exactMatch": True, "count": 1},
        ttl=ttl,
    )
    items = data.get("items", [])
    if not items:
        return None

    item = items[0]
    price_cents = item.get("buyNowPrice")
    if price_cents is None:
        price_cents = item.get("originalPrice")
    if price_cents is None:
        return None

    return {
        "price": round(price_cents / 100, 2),
        "source": "scmm",
        "market": item.get("buyNowFrom"),
        "itemId": item.get("id"),
        "url": item.get("buyNowUrl"),
    }


def fetch_scmm_profile_inventory_value(profile_id, currency="USD", ttl=1800):
    return cached_get(
        f"{SCMM_BASE_URL}/profile/{profile_id}/inventory/value",
        headers={"Currency": currency},
        params={"force": False},
        ttl=ttl,
    )


def fetch_scmm_profile_inventory_items(profile_id, currency="USD", ttl=1800):
    return cached_get(
        f"{SCMM_BASE_URL}/profile/{profile_id}/inventory/items",
        headers={"Currency": currency},
        ttl=ttl,
    )


def fetch_steam_market_price(item_name, ttl=1800):
    if not item_name:
        return None

    pd = cached_get(
        "https://steamcommunity.com/market/priceoverview/",
        params={"appid": RUST_APPID, "currency": 1, "market_hash_name": item_name},
        ttl=ttl
    )
    lp = pd.get("lowest_price", "$0")
    return {
        "price": float(re.sub(r'[^\d.]', '', lp) or "0"),
        "source": "steam-market",
        "market": "SteamCommunityMarket",
        "itemId": None,
        "url": None,
    }


def get_inventory_item_price(item_name):
    try:
        return fetch_scmm_price(item_name)
    except Exception as e:
        print(f"[WARN] SCMM 价格查询失败 {item_name}: {e}")

    try:
        return fetch_steam_market_price(item_name)
    except Exception as e:
        print(f"[WARN] Steam 市场价格查询失败 {item_name}: {e}")
        return None


def rarity_from_scmm_item(item):
    original_price = item.get("originalPrice") or 0
    if original_price >= 2000:
        return "legendary"
    if original_price >= 1000:
        return "epic"
    if original_price >= 500:
        return "rare"
    if original_price >= 100:
        return "uncommon"
    return "common"


def normalize_bm_name(value):
    return re.sub(r"[^a-z0-9]+", " ", (value or "").casefold()).strip()


def get_bm_session_preview(bm_player_id):
    headers = {"Authorization": f"Bearer {BATTLEMETRICS_TOKEN}"}
    try:
        data = cached_get(
            f"https://api.battlemetrics.com/players/{bm_player_id}/relationships/sessions",
            headers=headers,
            params={"page[size]": 1, "include": "server"},
            ttl=600,
        )
        return {
            "count": len(data.get("data", [])),
            "hasMore": bool(data.get("links", {}).get("next")),
        }
    except Exception as e:
        print(f"[WARN] BattleMetrics session preview 失败 {bm_player_id}: {e}")
        return {"count": 0, "hasMore": False}


# ══════════════════════════════════════════════════════════
#  Rust DLC 完整数据库 (硬编码 + 动态更新)
# ══════════════════════════════════════════════════════════

# 已知的 Rust DLC 列表 (截至 2025)
# 格式: appid -> { name, nameCN, description, type, releaseDate }
RUST_DLCS = {
    # ─── 扩展包 (Item Packs) ───
    1409640:  {"name": "Sunburn Pack",       "nameCN": "烈日灼烧包",   "type": "pack", "category": "扩展包"},
    1364310:  {"name": "Instrument Pack",    "nameCN": "乐器包",       "type": "pack", "category": "扩展包"},
    1670430:  {"name": "Voice Props Pack",   "nameCN": "语音道具包",   "type": "pack", "category": "扩展包"},
    2104200:  {"name": "Frontier Pack",      "nameCN": "前沿边境包",   "type": "pack", "category": "扩展包"},
    2199580:  {"name": "Arctic Pack",        "nameCN": "极地冰原包",   "type": "pack", "category": "扩展包"},
    2568580:  {"name": "Nomad Pack",         "nameCN": "游牧者包",     "type": "pack", "category": "扩展包"},
    2650780:  {"name": "Jungle Pack",        "nameCN": "丛林包",       "type": "pack", "category": "扩展包"},
    2804910:  {"name": "Devastated Pack",    "nameCN": "废墟包",       "type": "pack", "category": "扩展包"},
    2963480:  {"name": "Industrial Pack",    "nameCN": "工业包",       "type": "pack", "category": "扩展包"},
    # 新增 DLC (2024-2025, 可能有变动)
    3045860:  {"name": "Warhammer 40K Pack", "nameCN": "战锤40K包",    "type": "pack", "category": "联动扩展包"},
    # ─── 其他 DLC ───
    600850:   {"name": "Rust Soundtrack",    "nameCN": "原声音乐",     "type": "soundtrack", "category": "原声带"},
}

RUST_ITEMSTORE_TRANSLATIONS = {
    "Abyss Pack": "深渊包",
    "Adobe Building Skin": "土坯建筑皮肤",
    "Adobe Gate and Wall Pack": "土坯大门与围墙包",
    "Arctic Pack": "极地冰原包",
    "Artist Pack": "艺术家包",
    "Brick Building Skin": "砖砌建筑皮肤",
    "Brutalist Building Skin": "粗野主义建筑皮肤",
    "Bunny Costume": "兔子套装",
    "Bunny Hat": "兔子帽",
    "Carrot Chopper Salvaged Axe": "胡萝卜打捞斧",
    "Carrot SKS": "胡萝卜 SKS",
    "Chicken Costume": "小鸡套装",
    "Coconut Underwear": "椰子内衣",
    "Easter Bloom Helmet": "复活节花绽头盔",
    "Easter Bloom Kilt": "复活节花绽裙甲",
    "Easter Bloom Vest": "复活节花绽背心",
    "Easter Bunny Sheet Metal Door": "复活节兔金属门",
    "Easter Chicks Box": "复活节小鸡箱",
    "Easter Eggs": "复活节彩蛋",
    "Easter Grass": "复活节草垫",
    "Easter Madness Garage Door": "复活节狂欢车库门",
    "Easter Wreath Wrap": "复活节花环枪布",
    "Egg Destroyer Jackhammer": "彩蛋破坏者风镐",
    "Egg Hunter Poncho": "彩蛋猎手披风",
    "Egg Suit": "彩蛋套装",
    "Eggy AR": "彩蛋 AR",
    "Exhibit Decor Pack": "展陈装饰包",
    "Factory Door": "工厂门",
    "Floor & Ceiling Wallpaper Pack": "地板与天花板壁纸包",
    "Frontier Decor Pack": "边境装饰包",
    "Frontiersman Pack": "拓荒者包",
    "Gesture Pack": "动作包",
    "Graffiti Pack": "涂鸦包",
    "Horse Costume": "马匹套装",
    "Hot Cross Buns Rock": "十字热面包石头",
    "Ice King Pack": "冰雪之王包",
    "Industrial Lights": "工业灯具",
    "Jungle Building Skin": "丛林建筑皮肤",
    "Jungle Pack": "丛林包",
    "Legacy Wood Building Skin": "经典木质建筑皮肤",
    "Legacy Wood Gate and Wall Pack": "经典木质大门与围墙包",
    "Lumberjack Pack": "伐木工包",
    "Medieval Pack": "中世纪包",
    "Nest Hat": "鸟巢帽",
    "Nomad Outfit": "游牧装束",
    "Pattern Boomer": "花纹回旋镖",
    "Pilot Pack": "飞行员包",
    "Rattan Wicker": "藤编饰件",
    "Retro Tool Cupboard": "复古工具柜",
    "Royal Egg Furnace": "皇家彩蛋熔炉",
    "RPG Launcher": "RPG 发射器",
    "Rustigé Egg - Amethyst": "Rustigé 彩蛋 - 紫水晶",
    "Shipping Container Building Skin": "集装箱建筑皮肤",
    "Sofa - Pattern": "图案沙发",
    "Space LR-300 Assault Rifle": "太空 LR-300 突击步枪",
    "Space Station Building Skin": "空间站建筑皮肤",
    "Storage Box Pack": "储物箱包",
    "Trojan Egg Basket Grill": "特洛伊彩蛋烤架",
    "Wallpaper Starter Pack": "壁纸入门包",
    "Weapon Racks": "武器架",
}

for dlc in RUST_DLCS.values():
    if dlc.get("name") and dlc.get("nameCN"):
        RUST_ITEMSTORE_TRANSLATIONS.setdefault(dlc["name"], dlc["nameCN"])


def translate_rust_item_name(name):
    if not name:
        return name
    return RUST_ITEMSTORE_TRANSLATIONS.get(name, name)


def classify_rust_store_item(name):
    lowered = (name or "").casefold()
    if "building skin" in lowered:
        return "建筑皮肤"
    if "gate and wall pack" in lowered:
        return "大门与围墙包"
    if "decor pack" in lowered:
        return "装饰包"
    if "wallpaper" in lowered:
        return "壁纸包"
    if lowered.endswith(" pack") or " pack" in lowered:
        return "扩展包"
    if "costume" in lowered or "outfit" in lowered:
        return "服装"
    if any(token in lowered for token in ["door", "box", "cupboard", "lights", "sofa", "racks", "grill", "furnace"]):
        return "建造与装饰"
    return "商城物品"


def parse_price_value(price_text):
    if not price_text:
        return None
    cleaned = re.sub(r"[^\d,.\-]", "", price_text)
    if not cleaned:
        return None
    if "," in cleaned and "." not in cleaned:
        cleaned = cleaned.replace(",", ".")
    else:
        cleaned = cleaned.replace(",", "")
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def normalize_item_name(value):
    return re.sub(r"\s+", " ", (value or "").strip().casefold())


def fetch_rust_itemstore_catalog(ttl=86400):
    items = []
    start = 0
    page_size = 12
    pattern = re.compile(
        r'<div class="item_def_name ellipsis"><a href="(?P<url>[^"]+)"[^>]*>(?P<name>.*?)</a></div>\s*'
        r'<div class="item_def_price">\s*(?P<price>.*?)\s*</div>',
        re.S,
    )

    while True:
        data = cached_get(
            STEAM_ITEMSTORE_URL,
            params={"start": start, "count": page_size, "filter": "All", "l": "english", "cc": "us"},
            ttl=ttl,
        )
        total_count = int(data.get("total_count", 0) or 0)
        results_html = data.get("results_html", "")

        for match in pattern.finditer(results_html):
            name = unescape(match.group("name")).strip()
            url = match.group("url")
            price_text = " ".join(unescape(match.group("price")).split())
            detail_match = re.search(r"/detail/(\d+)/", url)
            items.append({
                "detailId": detail_match.group(1) if detail_match else None,
                "name": name,
                "nameCN": translate_rust_item_name(name),
                "category": classify_rust_store_item(name),
                "priceText": price_text,
                "priceValue": parse_price_value(price_text),
                "storeUrl": url,
                "source": "steam-itemstore",
            })

        start += page_size
        if start >= total_count:
            break

    return items


def fetch_rust_dlc_list():
    """
    从 Steam Store API 动态获取 Rust 的全部 DLC 列表
    API: store.steampowered.com/api/appdetails?appids=252490
    返回的 data.dlc 字段包含所有 DLC 的 appid 数组
    """
    try:
        data = cached_get(
            "https://store.steampowered.com/api/appdetails",
            params={"appids": RUST_APPID, "l": "schinese"},
            ttl=86400  # 缓存24小时
        )
        app_data = data.get(str(RUST_APPID), {})
        if app_data.get("success"):
            dlc_ids = app_data["data"].get("dlc", [])
            return dlc_ids
    except Exception as e:
        print(f"[WARN] 获取DLC列表失败: {e}")
    # 回退到硬编码列表
    return list(RUST_DLCS.keys())


def fetch_dlc_details(dlc_appid):
    """
    获取单个 DLC 的详细信息
    API: store.steampowered.com/api/appdetails?appids={dlc_appid}
    """
    try:
        data = cached_get(
            "https://store.steampowered.com/api/appdetails",
            params={"appids": dlc_appid, "l": "schinese", "cc": "us"},
            ttl=86400
        )
        dlc_data = data.get(str(dlc_appid), {})
        if dlc_data.get("success"):
            d = dlc_data["data"]
            price_info = d.get("price_overview", {})
            return {
                "appid": dlc_appid,
                "name": d.get("name", f"DLC #{dlc_appid}"),
                "type": d.get("type", "dlc"),
                "shortDescription": d.get("short_description", ""),
                "headerImage": d.get("header_image", ""),
                "capsuleImage": d.get("capsule_image", ""),
                "capsuleImageV5": d.get("capsule_imagev5", ""),
                "isFree": d.get("is_free", False),
                "price": {
                    "currency": price_info.get("currency", "USD"),
                    "initial": price_info.get("initial", 0) / 100,  # 分转元
                    "final": price_info.get("final", 0) / 100,
                    "discountPercent": price_info.get("discount_percent", 0),
                    "formatted": price_info.get("final_formatted", ""),
                },
                "releaseDate": d.get("release_date", {}).get("date", ""),
                "website": d.get("website", ""),
                "storeUrl": f"https://store.steampowered.com/app/{dlc_appid}",
            }
    except Exception as e:
        print(f"[WARN] 获取DLC详情失败 {dlc_appid}: {e}")
    
    # 回退到硬编码信息
    known = RUST_DLCS.get(dlc_appid, {})
    return {
        "appid": dlc_appid,
        "name": known.get("name", f"DLC #{dlc_appid}"),
        "type": "dlc",
        "shortDescription": "",
        "headerImage": "",
        "price": {"currency": "USD", "initial": 0, "final": 0, "discountPercent": 0, "formatted": ""},
        "storeUrl": f"https://store.steampowered.com/app/{dlc_appid}",
    }


def fetch_rust_inventory(steam_id, lang="schinese", count=2500, ttl=600):
    inv_url = f"https://steamcommunity.com/inventory/{steam_id}/{RUST_APPID}/2"
    first_page_count = 75
    base_params = {
        "l": lang,
        "preserve_bbcode": 1,
        "raw_asset_properties": 1,
    }

    try:
        first_page = cached_get(inv_url, params={**base_params, "count": first_page_count}, ttl=ttl)
        if not isinstance(first_page, dict):
            return None, "Rust 库存未公开、为空，或当前账号没有可访问的 Rust 物品库存"

        assets = list(first_page.get("assets", []))
        descriptions = list(first_page.get("descriptions", []))
        total_inventory_count = first_page.get("total_inventory_count") or sum(int(asset.get("amount", 1) or 1) for asset in assets)
        last_assetid = first_page.get("last_assetid")
        more_items = bool(first_page.get("more_items"))

        while more_items and last_assetid:
            page = cached_get(
                inv_url,
                params={**base_params, "count": count, "start_assetid": last_assetid},
                ttl=ttl,
            )
            if not isinstance(page, dict):
                break
            assets.extend(page.get("assets", []))
            descriptions.extend(page.get("descriptions", []))
            next_assetid = page.get("last_assetid")
            if not next_assetid or next_assetid == last_assetid:
                break
            last_assetid = next_assetid
            more_items = bool(page.get("more_items"))

        description_map = {}
        for description in descriptions:
            key = f"{description.get('classid')}_{description.get('instanceid')}"
            description_map[key] = description

        merged = dict(first_page)
        merged["assets"] = assets
        merged["descriptions"] = list(description_map.values())
        merged["more_items"] = 0
        merged["total_inventory_count"] = total_inventory_count
        return merged, None
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code in {400, 403, 404}:
            return None, "Rust 库存未公开、为空，或当前账号没有可访问的 Rust 物品库存"
        raise


def build_inventory_items_from_steam_web(inv_data, scmm_inventory_items=None, enable_market_fallback=False):
    descriptions = inv_data.get("descriptions", [])
    assets = inv_data.get("assets", [])
    desc_map = {}
    for description in descriptions:
        key = f"{description.get('classid')}_{description.get('instanceid')}"
        desc_map[key] = description

    scmm_by_name = {}
    for item in scmm_inventory_items or []:
        key = normalize_item_name(item.get("name"))
        if key:
            scmm_by_name[key] = item

    grouped_items = {}
    price_cache = {}

    for asset in assets:
        key = f"{asset.get('classid')}_{asset.get('instanceid')}"
        desc = desc_map.get(key, {})
        english_name = desc.get("market_hash_name") or desc.get("market_name") or desc.get("name") or "Unknown"
        localized_name = desc.get("name") or desc.get("market_name") or english_name
        if localized_name == english_name:
            localized_name = translate_rust_item_name(english_name)

        bucket_key = normalize_item_name(english_name)
        if not bucket_key:
            continue

        rarity = "common"
        item_type = ""
        for tag in desc.get("tags", []):
            if tag.get("category") == "Rarity":
                rv = tag.get("internal_name", "").lower()
                if any(token in rv for token in ["mythical", "legendary", "ancient"]):
                    rarity = "legendary"
                elif "rare" in rv:
                    rarity = "rare"
                elif "uncommon" in rv:
                    rarity = "uncommon"
            if tag.get("category") == "Type":
                item_type = tag.get("localized_tag_name") or tag.get("name") or item_type

        tradable = desc.get("tradable", 0) == 1
        marketable = desc.get("marketable", 0) == 1
        amount = int(asset.get("amount", 1) or 1)
        icon_url = desc.get("icon_url", "")
        if icon_url:
            icon_url = f"https://community.akamai.steamstatic.com/economy/image/{icon_url}/96x96"

        entry = grouped_items.setdefault(bucket_key, {
            "name": english_name,
            "nameCN": localized_name,
            "marketHashName": desc.get("market_hash_name") or english_name,
            "rarity": rarity,
            "type": item_type,
            "tradable": tradable,
            "marketable": marketable,
            "iconUrl": icon_url,
            "quantity": 0,
            "price": 0.0,
            "unitPrice": 0.0,
            "priceSource": None,
            "priceMarket": None,
            "scmmItemId": None,
            "source": "steam-web",
        })

        entry["quantity"] += amount
        entry["tradable"] = entry["tradable"] or tradable
        entry["marketable"] = entry["marketable"] or marketable
        if len(localized_name) > len(entry["nameCN"] or ""):
            entry["nameCN"] = localized_name
        if not entry["iconUrl"] and icon_url:
            entry["iconUrl"] = icon_url
        if entry["rarity"] == "common":
            entry["rarity"] = rarity
        if not entry["type"] and item_type:
            entry["type"] = item_type

    for bucket_key, entry in grouped_items.items():
        scmm_item = scmm_by_name.get(bucket_key)
        price_info = None
        if scmm_item:
            unit_price = ((scmm_item.get("buyNowPrice") or 0) / 100) if scmm_item.get("buyNowPrice") is not None else 0
            entry["unitPrice"] = round(unit_price, 2)
            entry["price"] = round(unit_price * entry["quantity"], 2)
            entry["priceSource"] = "scmm-profile"
            entry["priceMarket"] = scmm_item.get("buyNowFrom")
            entry["scmmItemId"] = scmm_item.get("id")
            entry["source"] = "steam-web+scmm"
        elif enable_market_fallback and entry["marketable"]:
            market_hash = entry.get("marketHashName")
            if market_hash:
                if market_hash not in price_cache:
                    price_cache[market_hash] = get_inventory_item_price(market_hash)
                price_info = price_cache.get(market_hash)
            if price_info:
                entry["unitPrice"] = round(price_info["price"], 2)
                entry["price"] = round(price_info["price"] * entry["quantity"], 2)
                entry["priceSource"] = price_info["source"]
                entry["priceMarket"] = price_info["market"]
                entry["scmmItemId"] = price_info["itemId"]
                entry["source"] = "steam-web+market"

        if entry["nameCN"] == entry["name"]:
            entry["nameCN"] = translate_rust_item_name(entry["name"])

    return list(grouped_items.values())


def check_dlc_ownership(dlc_appids, inv_data=None):
    """
    检测玩家是否拥有指定的 DLC
    
    方法一: 通过 Steam 库存检测 DLC 物品
    DLC 包的物品会出现在库存中, 带有特殊标签(如 "item_class" 等)
    
    方法二: 通过 Steam 商店 API userdata (需要 cookie, 不推荐)
    
    方法三: 通过库存中 item 的 tag 匹配 DLC 包名
    Rust DLC 物品在库存 descriptions 中会带有:
    - tags[].internal_name 包含 "Workshop" 或对应 DLC 标识
    - 部分 DLC 物品 market_fee_app 为 DLC appid
    
    实际上最可靠的方法: 
    解析库存中的每个物品, 检查其 tags 中是否包含 DLC 包相关标记
    """
    owned = set()
    
    if not inv_data:
        return None

    try:
        descriptions = inv_data.get("descriptions", [])
        
        # DLC 物品检测规则:
        # 1. 物品标签中包含特定 DLC 关键词
        # 2. 物品名中包含 DLC 包标志性物品名
        
        dlc_item_keywords = {
            1409640:  ["sunburn", "inner tube", "pool", "water gun", "boogie board"],
            1364310:  ["instrument", "piano", "guitar", "drum", "trumpet", "xylophone", "sousaphone", "jerry can guitar", "pan flute", "cowbell", "canbourine", "plumber"],
            1670430:  ["voice props", "boom box", "cassette", "megaphone", "microphone", "mobile phone", "disco", "laser light", "connected speaker", "disco floor"],
            2104200:  ["frontier", "barrel storage", "wanted", "saddle", "hitchin"],
            2199580:  ["arctic", "sled", "snowmobile seat", "ice", "fur"],
            2568580:  ["nomad", "yurt", "tent", "carpet", "camel"],
            2650780:  ["jungle", "bamboo", "tiki", "tribal", "vine", "jungle pack"],
            2804910:  ["devastated", "ruin", "rubble", "debris"],
            2963480:  ["industrial", "conveyor", "factory", "pipe"],
            3045860:  ["warhammer", "40k", "40,000", "krieg", "death korps"],
        }
        
        for desc in descriptions:
            item_name_lower = desc.get("name", "").lower()
            item_tags = desc.get("tags", [])
            
            # 用关键词匹配
            for dlc_id, keywords in dlc_item_keywords.items():
                if dlc_id in dlc_appids:
                    for kw in keywords:
                        if kw in item_name_lower:
                            owned.add(dlc_id)
                            break
            
            # 额外: 检查 market_fee_app 字段 (部分物品会标记所属 DLC)
            fee_app = desc.get("market_fee_app")
            if fee_app and fee_app in dlc_appids:
                owned.add(fee_app)
    
    except Exception as e:
        print(f"[WARN] DLC 检测失败: {e}")
        return None
    
    return owned


# ══════════════════════════════════════════════════════════
#  玩家基础信息
# ══════════════════════════════════════════════════════════

def get_player_summary(steam_id):
    if not steam_api_key_set():
        raise ConfigurationError("Steam API Key 未配置")
    url = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/"
    data = cached_get(url, params={"key": STEAM_API_KEY, "steamids": steam_id})
    players = data.get("response", {}).get("players", [])
    if not players:
        return None
    p = players[0]
    summary = {
        "steamId": p.get("steamid"),
        "name": p.get("personaname", "Unknown"),
        "avatar": p.get("avatarfull", ""),
        "avatarMedium": p.get("avatarmedium", ""),
        "profileUrl": p.get("profileurl", ""),
        "status": ["离线", "在线", "忙碌", "离开", "打盹", "交易", "游戏中"][p.get("personastate", 0)],
        "gameId": p.get("gameid"),
        "gameInfo": p.get("gameextrainfo"),
        "created": p.get("timecreated"),
        "country": p.get("loccountrycode", ""),
        "lastLogoff": p.get("lastlogoff"),
    }
    if summary["created"]:
        summary["createdAt"] = datetime.utcfromtimestamp(summary["created"]).isoformat() + "Z"
    if summary["lastLogoff"]:
        summary["lastLogoffAt"] = datetime.utcfromtimestamp(summary["lastLogoff"]).isoformat() + "Z"

    try:
        playtime = get_rust_playtime(steam_id)
        summary.update(playtime)
    except Exception as e:
        print(f"[WARN] 获取 Rust 时长失败 {steam_id}: {e}")
        summary.update({
            "playtimeMinutes": None,
            "playtimeHours": None,
            "playtimeTwoWeeksMinutes": None,
            "playtimeTwoWeeksHours": None,
        })

    try:
        summary["achievementsCount"] = get_rust_achievement_count(steam_id)
    except Exception as e:
        print(f"[WARN] 获取 Rust 成就失败 {steam_id}: {e}")
        summary["achievementsCount"] = None

    return summary


def get_rust_playtime(steam_id):
    if not steam_api_key_set():
        raise ConfigurationError("Steam API Key 未配置")

    url = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/"
    data = cached_get(
        url,
        params={
            "key": STEAM_API_KEY,
            "steamid": steam_id,
            "include_played_free_games": 1,
            "include_appinfo": 0,
        },
        ttl=3600,
    )
    games = data.get("response", {}).get("games", [])
    rust_game = next((g for g in games if g.get("appid") == RUST_APPID), None)
    if not rust_game:
        return {
            "playtimeMinutes": None,
            "playtimeHours": None,
            "playtimeTwoWeeksMinutes": None,
            "playtimeTwoWeeksHours": None,
        }

    total_minutes = rust_game.get("playtime_forever")
    recent_minutes = rust_game.get("playtime_2weeks")
    return {
        "playtimeMinutes": total_minutes,
        "playtimeHours": round(total_minutes / 60, 1) if total_minutes is not None else None,
        "playtimeTwoWeeksMinutes": recent_minutes,
        "playtimeTwoWeeksHours": round(recent_minutes / 60, 1) if recent_minutes is not None else None,
    }


def get_rust_achievement_count(steam_id):
    if not steam_api_key_set():
        raise ConfigurationError("Steam API Key 未配置")

    url = "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/"
    try:
        data = cached_get(url, params={"appid": RUST_APPID, "key": STEAM_API_KEY, "steamid": steam_id}, ttl=3600)
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 500:
            return None
        raise

    achievements = data.get("playerstats", {}).get("achievements", [])
    if not achievements:
        return None
    return sum(1 for a in achievements if a.get("achieved") == 1)


def resolve_vanity_url(vanity_name):
    if not steam_api_key_set():
        return None
    url = "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/"
    try:
        data = cached_get(url, params={"key": STEAM_API_KEY, "vanityurl": vanity_name})
        resp = data.get("response", {})
        if resp.get("success") == 1:
            return resp["steamid"]
    except Exception as e:
        print(f"[WARN] Vanity URL 解析失败 {vanity_name}: {e}")
    return None


def resolve_steam_id(input_str):
    """统一解析各种格式的 Steam ID 输入"""
    s = input_str.strip().rstrip("/")
    
    # 已经是 SteamID64
    if s.isdigit() and len(s) == 17:
        return s
    
    # Steam URL: https://steamcommunity.com/profiles/76561198067054205
    m = re.search(r"steamcommunity\.com/profiles/(\d{17})", s)
    if m:
        return m.group(1)
    
    # Vanity URL: https://steamcommunity.com/id/xxxxx
    m = re.search(r"steamcommunity\.com/id/([^/]+)", s)
    if m:
        return resolve_vanity_url(m.group(1))
    
    # 纯文字 → 尝试 vanity
    resolved = resolve_vanity_url(s)
    if resolved:
        return resolved
    
    return None


# ══════════════════════════════════════════════════════════
#  模块 1: KDA
# ══════════════════════════════════════════════════════════

def stat_value(stats, *names):
    for name in names:
        if name in stats:
            return stats.get(name, 0) or 0
    return 0


def stat_sum(stats, *names):
    return sum(stat_value(stats, name) for name in names)


def build_stat_section(section_id, title, emoji, color, items):
    return {
        "id": section_id,
        "title": title,
        "emoji": emoji,
        "color": color,
        "items": [
            {"id": item_id, "label": label, "value": value, "icon": icon}
            for item_id, label, value, icon in items
        ],
    }


def format_duration_stat(seconds):
    if seconds is None:
        return "—"
    if seconds == 0:
        return "0分钟"
    if seconds >= 3600:
        hours = round(seconds / 3600, 1)
        return f"{int(hours)}小时" if float(hours).is_integer() else f"{hours}小时"
    minutes = round(seconds / 60, 1)
    return f"{int(minutes)}分钟" if float(minutes).is_integer() else f"{minutes}分钟"

def get_player_kda(steam_id):
    if not steam_api_key_set():
        raise ConfigurationError("Steam API Key 未配置")
    url = "https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/"
    try:
        data = cached_get(url, params={"appid": RUST_APPID, "key": STEAM_API_KEY, "steamid": steam_id})
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 500:
            return {"error": "玩家资料未公开或无 Rust 游戏数据"}
        raise

    stats_list = data.get("playerstats", {}).get("stats", [])
    stats = {s["name"]: s["value"] for s in stats_list}

    kills = stat_value(stats, "kill_player")
    deaths = stat_value(stats, "deaths")
    headshots = stat_value(stats, "headshots", "headshot")
    bullets_fired = stat_value(stats, "bullet_fired")
    bullet_hits_total = stat_value(stats, "bullet_hit_entity") or stat_sum(
        stats,
        "bullet_hit_player",
        "bullet_hit_bear",
        "bullet_hit_boar",
        "bullet_hit_stag",
        "bullet_hit_wolf",
        "bullet_hit_horse",
        "bullet_hit_building",
        "bullet_hit_sign",
        "bullet_hit_playercorpse",
        "bullet_hit_corpse",
    )
    bullet_hits_player = stat_value(stats, "bullet_hit_player")
    arrows_fired = stat_value(stats, "arrows_shot", "arrow_fired")
    arrow_hits_total = stat_value(stats, "arrow_hit_entity") or stat_sum(
        stats,
        "arrow_hit_player",
        "arrow_hit_bear",
        "arrow_hit_boar",
        "arrow_hit_stag",
        "arrow_hit_wolf",
        "arrow_hit_horse",
        "arrow_hit_chicken",
        "arrow_hit_building",
    )
    shotgun_fired = stat_value(stats, "shotgun_fired")
    shotgun_hits_total = stat_value(stats, "shotgun_hit_entity") or stat_sum(
        stats,
        "shotgun_hit_player",
        "shotgun_hit_horse",
        "shotgun_hit_building",
    )

    resources = {
        "metalOre": stat_value(stats, "harvest.metal_ore", "acquired_metal.ore"),
        "sulfurOre": stat_value(stats, "harvest.sulfur_ore"),
        "stone": stat_value(stats, "harvest.stones", "harvested_stones"),
        "wood": stat_value(stats, "harvest.wood", "harvested_wood"),
        "scrap": stat_value(stats, "acquired_scrap"),
        "lowGradeFuel": stat_value(stats, "acquired_lowgradefuel"),
        "cloth": stat_value(stats, "harvest.cloth", "harvested_cloth"),
        "leather": stat_value(stats, "harvested_leather"),
        "boneFragments": stat_value(stats, "harvest.bone_fragments"),
        "animalFat": stat_value(stats, "harvest.fat_animal"),
    }

    kills_breakdown = {
        "player": kills,
        "scientist": stat_value(stats, "kill_scientist"),
        "wolf": stat_value(stats, "kill_wolf"),
        "bear": stat_value(stats, "kill_bear"),
        "boar": stat_value(stats, "kill_boar"),
        "stag": stat_value(stats, "kill_stag"),
        "horse": stat_value(stats, "kill_horse"),
        "chicken": stat_value(stats, "kill_chicken"),
    }

    medical = {
        "wounded": stat_value(stats, "wounded"),
        "assisted": stat_value(stats, "wounded_assisted"),
        "healed": stat_value(stats, "wounded_healed"),
        "selfInflicted": stat_value(stats, "death_selfinflicted"),
    }

    deaths_breakdown = {
        "total": deaths,
        "suicide": stat_value(stats, "death_suicide"),
        "fall": stat_value(stats, "death_fall"),
        "entity": stat_value(stats, "death_entity"),
        "wolf": stat_value(stats, "death_wolf"),
        "bear": stat_value(stats, "death_bear"),
    }

    bullet = {
        "fired": bullets_fired,
        "hitsTotal": bullet_hits_total,
        "hitsPlayer": bullet_hits_player,
        "hitsBear": stat_value(stats, "bullet_hit_bear"),
        "hitsBoar": stat_value(stats, "bullet_hit_boar"),
        "hitsStag": stat_value(stats, "bullet_hit_stag"),
        "hitsWolf": stat_value(stats, "bullet_hit_wolf"),
        "hitsHorse": stat_value(stats, "bullet_hit_horse"),
        "hitsBuilding": stat_value(stats, "bullet_hit_building"),
        "hitsOther": stat_sum(stats, "bullet_hit_sign", "bullet_hit_playercorpse", "bullet_hit_corpse"),
    }

    arrow = {
        "fired": arrows_fired,
        "hitsTotal": arrow_hits_total,
        "hitsPlayer": stat_value(stats, "arrow_hit_player"),
        "hitsBear": stat_value(stats, "arrow_hit_bear"),
        "hitsBoar": stat_value(stats, "arrow_hit_boar"),
        "hitsStag": stat_value(stats, "arrow_hit_stag"),
        "hitsWolf": stat_value(stats, "arrow_hit_wolf"),
        "hitsHorse": stat_value(stats, "arrow_hit_horse"),
        "hitsBuilding": stat_value(stats, "arrow_hit_building"),
        "hitsChicken": stat_value(stats, "arrow_hit_chicken"),
    }

    shotgun = {
        "fired": shotgun_fired,
        "hitsTotal": shotgun_hits_total,
        "hitsPlayer": stat_value(stats, "shotgun_hit_player"),
        "hitsHorse": stat_value(stats, "shotgun_hit_horse"),
        "hitsBuilding": stat_value(stats, "shotgun_hit_building"),
    }

    building = {
        "placed": stat_value(stats, "placed_blocks"),
        "upgraded": stat_value(stats, "upgraded_blocks"),
        "blueprints": stat_value(stats, "blueprint_studied"),
    }

    misc = {
        "rocketsFired": stat_value(stats, "rocket_fired"),
        "grenadesThrown": stat_value(stats, "grenades_thrown"),
        "inventoryOpened": stat_value(stats, "INVENTORY_OPENED"),
        "itemDrop": stat_value(stats, "item_drop"),
        "destroyedBarrels": stat_value(stats, "destroyed_barrels"),
        "craftingOpened": stat_value(stats, "CRAFTING_OPENED"),
        "mapOpened": stat_value(stats, "MAP_OPENED"),
        "cupboardOpened": stat_value(stats, "CUPBOARD_OPENED"),
        "horseDistanceKm": round(
            stat_value(stats, "horse_distance_ridden_km") or stat_value(stats, "horse_distance_ridden") / 1000,
            1,
        ),
        "meleeStrikes": stat_value(stats, "melee_strikes"),
        "meleeThrown": stat_value(stats, "melee_thrown"),
        "caloriesConsumed": stat_value(stats, "calories_consumed"),
        "waterConsumed": stat_value(stats, "water_consumed"),
    }

    menu_usage = {
        "inventory": misc["inventoryOpened"],
        "crafting": misc["craftingOpened"],
        "map": misc["mapOpened"],
        "cupboard": misc["cupboardOpened"],
    }

    gathering_actions = {
        "oreHits": stat_value(stats, "ORE_HIT"),
        "treeHits": stat_value(stats, "TREE_HIT"),
    }

    horse = {
        "kilometers": round(stat_value(stats, "horse_distance_ridden_km") or stat_value(stats, "horse_distance_ridden") / 1000, 2),
        "miles": round((stat_value(stats, "horse_distance_ridden_km") or stat_value(stats, "horse_distance_ridden") / 1000) * 0.621371, 2),
        "rides": stat_value(stats, "horse_mounted_count"),
    }

    consumption = {
        "calories": misc["caloriesConsumed"],
        "water": misc["waterConsumed"],
    }

    exposure = {
        "comfort": stat_value(stats, "comfort_duration"),
        "radiation": stat_value(stats, "radiation_exposure_duration"),
        "cold": stat_value(stats, "cold_exposure_duration"),
        "heat": stat_value(stats, "hot_exposure_duration"),
    }

    instruments = {
        "notesPlayed": stat_value(stats, "notesplayed", "InstrumentNotesPlayed"),
        "noteBinds": stat_value(stats, "InstrumentNotesPlayedBinds"),
        "fullKeyboard": stat_value(stats, "InstrumentFullKeyboardMode"),
    }

    fish = {
        "anchovy": stat_value(stats, "caught_anchovy"),
        "herring": stat_value(stats, "caught_herring"),
        "sardine": stat_value(stats, "caught_sardine"),
        "smallTrout": stat_value(stats, "caught_small_trout"),
        "yellowPerch": stat_value(stats, "caught_yellow_perch"),
        "orangeRoughy": stat_value(stats, "caught_orange_roughy"),
        "smallShark": stat_value(stats, "caught_small_shark"),
        "salmon": stat_value(stats, "caught_salmon"),
        "catfish": stat_value(stats, "caught_catfish"),
    }

    other_stats = {
        "barrelsDestroyed": misc["destroyedBarrels"],
        "itemsDropped": misc["itemDrop"],
        "bpsLearned": building["blueprints"],
        "missionsCompleted": stat_value(stats, "missions_completed"),
        "voiceChatTime": stat_value(stats, "seconds_speaking"),
        "carsShredded": stat_value(stats, "cars_shredded"),
        "itemsInspected": stat_value(stats, "ITEM_EXAMINED"),
        "rocketsFired": misc["rocketsFired"],
        "pipesConnected": stat_value(stats, "pipes_connected"),
        "wiresConnected": stat_value(stats, "wires_connected"),
        "helipadLandings": stat_value(stats, "helipad_landings"),
        "sharkKillsSpeargun": stat_value(stats, "shark_speargun_kills"),
        "kayakDistanceTravelled": stat_value(stats, "kayak_distance_travelled"),
        "scopeZoomChanged": stat_value(stats, "scope_zoom_changed"),
        "friendlyWaves": stat_value(stats, "waved_at_players", "gesture_wave_count"),
        "mlrsKills": stat_value(stats, "mlrs_kills"),
        "beeAttacks": stat_value(stats, "bee_attacks_count"),
        "tinCanAlarmsWired": stat_value(stats, "tincanalarms_wired"),
    }

    sections = [
        build_stat_section("pvp", "PVP", "⚔️", "#ef5350", [
            ("kills", "击杀", kills, "💀"),
            ("deaths", "死亡", deaths, "☠️"),
            ("kd", "KD", round(kills / deaths, 2) if deaths > 0 else 999, "📊"),
            ("bulletFired", "子弹发射", bullets_fired, "🔫"),
            ("bulletHitPlayer", "子弹命中", bullet_hits_player, "🎯"),
            ("headshots", "子弹爆头", headshots, "🔥"),
        ]),
        build_stat_section("bulletHits", "子弹命中", "🔸", "#42a5f5", [
            ("players", "玩家", bullet["hitsPlayer"], "🧍"),
            ("deadPlayers", "已死亡玩家", stat_sum(stats, "bullet_hit_playercorpse", "bullet_hit_corpse"), "⚰️"),
            ("buildings", "建筑", bullet["hitsBuilding"], "🏠"),
            ("signs", "告示牌", stat_value(stats, "bullet_hit_sign"), "🪧"),
            ("deer", "鹿", bullet["hitsStag"], "🦌"),
            ("bears", "熊", bullet["hitsBear"], "🐻"),
            ("boars", "野猪", bullet["hitsBoar"], "🐗"),
            ("horses", "马", bullet["hitsHorse"], "🐎"),
            ("wolves", "狼", bullet["hitsWolf"], "🐺"),
        ]),
        build_stat_section("kills", "击杀分布", "🐾", "#ff7043", [
            ("player", "玩家", kills_breakdown["player"], "🧍"),
            ("scientist", "科学家", kills_breakdown["scientist"], "🧪"),
            ("wolf", "狼", kills_breakdown["wolf"], "🐺"),
            ("bear", "熊", kills_breakdown["bear"], "🐻"),
            ("boar", "野猪", kills_breakdown["boar"], "🐗"),
            ("stag", "鹿", kills_breakdown["stag"], "🦌"),
            ("horse", "马", kills_breakdown["horse"], "🐎"),
            ("chicken", "鸡", kills_breakdown["chicken"], "🐔"),
        ]),
        build_stat_section("bow", "弓箭统计", "🏹", "#7cb342", [
            ("fired", "发射", arrow["fired"], "🏹"),
            ("hitsPlayer", "玩家命中", arrow["hitsPlayer"], "🧍"),
            ("hitsBuilding", "建筑命中", arrow["hitsBuilding"], "🏠"),
            ("hitRate", "命中率", round(arrow["hitsPlayer"] / arrows_fired * 100, 2) if arrows_fired > 0 else 0, "🎯"),
            ("deer", "鹿", arrow["hitsStag"], "🦌"),
            ("bears", "熊", arrow["hitsBear"], "🐻"),
            ("boars", "野猪", arrow["hitsBoar"], "🐗"),
            ("horses", "马", arrow["hitsHorse"], "🐎"),
            ("chickens", "鸡", arrow["hitsChicken"], "🐔"),
            ("wolves", "狼", arrow["hitsWolf"], "🐺"),
        ]),
        build_stat_section("shotgun", "霰弹枪统计", "💥", "#8d6e63", [
            ("fired", "发射", shotgun["fired"], "🔫"),
            ("hitsPlayer", "玩家命中", shotgun["hitsPlayer"], "🧍"),
            ("hitsBuilding", "建筑命中", shotgun["hitsBuilding"], "🏠"),
            ("otherHits", "其他命中", max(0, shotgun["hitsTotal"] - shotgun["hitsPlayer"] - shotgun["hitsBuilding"]), "📦"),
        ]),
        build_stat_section("deaths", "死亡统计", "☠️", "#b0bec5", [
            ("total", "总死亡", deaths_breakdown["total"], "💀"),
            ("fall", "跌落致死", deaths_breakdown["fall"], "🧗"),
            ("suicide", "自杀", deaths_breakdown["suicide"], "🪦"),
            ("selfInflicted", "自伤", medical["selfInflicted"], "⚠️"),
        ]),
        build_stat_section("wounds", "受伤统计", "🩹", "#66bb6a", [
            ("wounded", "受伤次数", medical["wounded"], "🩸"),
            ("healed", "包扎恢复", medical["healed"], "🧰"),
            ("assisted", "助攻", medical["assisted"], "🤝"),
        ]),
        build_stat_section("menuUsage", "菜单使用", "🗂️", "#78909c", [
            ("inventory", "库存", menu_usage["inventory"], "🎒"),
            ("crafting", "制作", menu_usage["crafting"], "🛠️"),
            ("map", "地图", menu_usage["map"], "🗺️"),
            ("cupboard", "领地柜", menu_usage["cupboard"], "🧰"),
        ]),
        build_stat_section("resources", "采集资源", "⛏️", "#26a69a", [
            ("wood", "木头", resources["wood"], "🪵"),
            ("stone", "石头", resources["stone"], "🧱"),
            ("metalOre", "金属矿石", resources["metalOre"], "🪨"),
            ("scrap", "废料", resources["scrap"], "🧲"),
            ("cloth", "布", resources["cloth"], "🧶"),
            ("leather", "皮革", resources["leather"], "🧥"),
            ("lowGradeFuel", "低级燃料", resources["lowGradeFuel"], "🛢️"),
            ("oreHits", "矿点命中", gathering_actions["oreHits"], "⛏️"),
            ("treeHits", "树木命中", gathering_actions["treeHits"], "🌲"),
        ]),
        build_stat_section("building", "建筑统计", "🏗️", "#ffa726", [
            ("placed", "建筑建造", building["placed"], "🏗️"),
            ("upgraded", "建筑升级", building["upgraded"], "🧱"),
        ]),
        build_stat_section("horse", "马匹统计", "🐎", "#8d6e63", [
            ("kilometers", "骑行公里", horse["kilometers"], "🛣️"),
            ("miles", "骑行英里", horse["miles"], "📏"),
            ("rides", "骑乘次数", horse["rides"], "🐎"),
        ]),
        build_stat_section("melee", "近战统计", "🔪", "#ef5350", [
            ("meleeStrikes", "近战攻击", misc["meleeStrikes"], "🔪"),
            ("meleeThrown", "近战投掷", misc["meleeThrown"], "🪓"),
        ]),
        build_stat_section("consumption", "消耗统计", "🍖", "#ff7043", [
            ("calories", "卡路里", consumption["calories"], "🍖"),
            ("water", "水量", consumption["water"], "💧"),
        ]),
        build_stat_section("exposure", "环境暴露", "🌡️", "#90a4ae", [
            ("comfort", "舒适时间", format_duration_stat(exposure["comfort"]), "🛋️"),
            ("radiation", "辐射时间", format_duration_stat(exposure["radiation"]), "☢️"),
            ("cold", "寒冷时间", format_duration_stat(exposure["cold"]), "🧊"),
            ("heat", "炎热时间", format_duration_stat(exposure["heat"]), "🔥"),
        ]),
        build_stat_section("instruments", "乐器统计", "🎵", "#ab47bc", [
            ("notesPlayed", "演奏音符", instruments["notesPlayed"], "🎹"),
            ("noteBinds", "音符绑定", instruments["noteBinds"], "🎛️"),
            ("fullKeyboard", "全键盘模式", instruments["fullKeyboard"], "⌨️"),
        ]),
        build_stat_section("fish", "捕鱼统计", "🎣", "#42a5f5", [
            ("anchovy", "鳀鱼", fish["anchovy"], "🐟"),
            ("herring", "鲱鱼", fish["herring"], "🐠"),
            ("sardine", "沙丁鱼", fish["sardine"], "🐟"),
            ("smallTrout", "小鳟鱼", fish["smallTrout"], "🐠"),
            ("yellowPerch", "黄鲈", fish["yellowPerch"], "🐟"),
            ("orangeRoughy", "金目鲷", fish["orangeRoughy"], "🐠"),
            ("smallShark", "小鲨鱼", fish["smallShark"], "🦈"),
            ("salmon", "鲑鱼", fish["salmon"], "🐟"),
            ("catfish", "鲶鱼", fish["catfish"], "🐠"),
        ]),
        build_stat_section("other", "其他统计", "🧰", "#ab47bc", [
            ("barrelsDestroyed", "摧毁油桶", other_stats["barrelsDestroyed"], "🛢️"),
            ("itemsDropped", "物品掉落", other_stats["itemsDropped"], "🎒"),
            ("bpsLearned", "学习蓝图", other_stats["bpsLearned"], "📘"),
            ("missionsCompleted", "完成任务", other_stats["missionsCompleted"], "🧭"),
            ("voiceChatTime", "语音时长", format_duration_stat(other_stats["voiceChatTime"]), "🎤"),
            ("carsShredded", "报废车辆", other_stats["carsShredded"], "🚗"),
            ("itemsInspected", "检查物品", other_stats["itemsInspected"], "🔎"),
            ("rocketsFired", "火箭发射", other_stats["rocketsFired"], "🚀"),
            ("pipesConnected", "连接管道", other_stats["pipesConnected"], "🧪"),
            ("wiresConnected", "连接电线", other_stats["wiresConnected"], "🔌"),
            ("helipadLandings", "停机坪降落", other_stats["helipadLandings"], "🚁"),
            ("sharkKillsSpeargun", "鱼叉击杀鲨鱼", other_stats["sharkKillsSpeargun"], "🦈"),
            ("kayakDistanceTravelled", "皮划艇距离(m)", other_stats["kayakDistanceTravelled"], "🛶"),
            ("scopeZoomChanged", "镜头缩放切换", other_stats["scopeZoomChanged"], "🔭"),
            ("friendlyWaves", "友好挥手", other_stats["friendlyWaves"], "👋"),
            ("mlrsKills", "MLRS 击杀", other_stats["mlrsKills"], "🚀"),
            ("beeAttacks", "遭蜜蜂攻击", other_stats["beeAttacks"], "🐝"),
            ("tinCanAlarmsWired", "罐头警报器接线", other_stats["tinCanAlarmsWired"], "🥫"),
        ]),
    ]

    return {
        "stats": stats,
        "summary": {
            "kills": kills, "deaths": deaths, "headshots": headshots,
            "kdRatio": round(kills / deaths, 2) if deaths > 0 else 999,
            "headshotRate": round(headshots / bullet_hits_player * 100, 2) if bullet_hits_player > 0 else 0,
            "accuracy": round(bullet_hits_player / bullets_fired * 100, 2) if bullets_fired > 0 else 0,
            "bulletsFired": bullets_fired,
            "bulletsHit": bullet_hits_total,
            "bulletsHitPlayer": bullet_hits_player,
            "rocketsFired": misc["rocketsFired"],
            "arrowsFired": arrows_fired,
            "shotgunFired": shotgun_fired,
        },
        "resources": resources,
        "animals": kills_breakdown,
        "medical": medical,
        "deaths": deaths_breakdown,
        "bullet": bullet,
        "arrow": arrow,
        "shotgun": shotgun,
        "building": building,
        "misc": misc,
        "menuUsage": menu_usage,
        "gatheringActions": gathering_actions,
        "horse": horse,
        "consumption": consumption,
        "exposure": exposure,
        "instruments": instruments,
        "fish": fish,
        "otherStats": other_stats,
        "sections": sections,
    }


# ══════════════════════════════════════════════════════════
#  模块 2: 库存 + DLC 合并查询
# ══════════════════════════════════════════════════════════

def get_player_inventory_with_dlc(steam_id):
    """
    获取玩家完整资产: 可交易库存皮肤 + DLC 扩展包
    
    数据来源:
    ┌────────────────────────┬──────────────────────────────────────┐
    │ 可交易皮肤 (Skins)     │ Steam Community Inventory API        │
    │                        │ /inventory/{steamid}/252490/2        │
    ├────────────────────────┼──────────────────────────────────────┤
    │ DLC 扩展包 (Packs)     │ Steam Store API (DLC列表+详情)       │
    │                        │ + 库存物品关键词匹配 (检测是否拥有)   │
    ├────────────────────────┼──────────────────────────────────────┤
    │ DLC 价格               │ Steam Store API appdetails           │
    │                        │ price_overview 字段                  │
    └────────────────────────┴──────────────────────────────────────┘
    """
    result = {
        "skins": [],          # 可交易/上架的库存皮肤
        "dlcs": [],           # DLC 扩展包列表 (含是否拥有)
        "storeCatalog": [],   # 当前 Rust 官方商城目录
        "skinsSummary": {},
        "dlcSummary": {},
        "storeSummary": {},
        "totalSummary": {},
        "inventoryAvailable": True,
        "dlcOwnershipAvailable": True,
    }

    inv_data = None
    inv_error = None
    scmm_inventory_value = None
    scmm_inventory_items = None
    store_catalog = []

    # ────────────── 第一部分: 库存皮肤 ──────────────
    try:
        scmm_inventory_value = fetch_scmm_profile_inventory_value(steam_id)
        scmm_inventory_items = fetch_scmm_profile_inventory_items(steam_id)
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code in {400, 401, 404}:
            scmm_inventory_value = None
            scmm_inventory_items = None
        else:
            print(f"[WARN] SCMM 库存价值获取失败 {steam_id}: {e}")
    except Exception as e:
        print(f"[WARN] SCMM 库存获取失败 {steam_id}: {e}")

    try:
        inv_data, inv_error = fetch_rust_inventory(steam_id, lang="schinese")
    except Exception as e:
        inv_error = f"库存获取失败: {str(e)}"

    try:
        if inv_data and inv_data.get("assets"):
            result["skins"] = build_inventory_items_from_steam_web(
                inv_data,
                scmm_inventory_items=scmm_inventory_items,
                enable_market_fallback=not bool(scmm_inventory_items),
            )
        elif scmm_inventory_items:
            for item in scmm_inventory_items:
                quantity = item.get("quantity", 1) or 1
                total_price_cents = item.get("totalBuyNowPrice")
                unit_price_cents = item.get("buyNowPrice")
                total_price = (total_price_cents if total_price_cents is not None else (unit_price_cents or 0) * quantity) / 100
                unit_price = (unit_price_cents or 0) / 100
                tradable_marketable = any(stack.get("tradableAndMarketable", False) for stack in item.get("stacks", []))

                result["skins"].append({
                    "name": item.get("name", "Unknown"),
                    "nameCN": item.get("name", "Unknown"),
                    "marketHashName": item.get("name", ""),
                    "rarity": rarity_from_scmm_item(item),
                    "type": item.get("itemType", ""),
                    "tradable": tradable_marketable,
                    "marketable": tradable_marketable,
                    "iconUrl": item.get("iconUrl", ""),
                    "price": round(total_price, 2),
                    "unitPrice": round(unit_price, 2),
                    "quantity": quantity,
                    "priceSource": "scmm-profile",
                    "priceMarket": item.get("buyNowFrom"),
                    "scmmItemId": item.get("id"),
                    "source": "scmm-profile",
                })
        elif inv_error:
            result["inventoryAvailable"] = False
            result["skinsSummary"]["error"] = inv_error
        else:
            result["inventoryAvailable"] = False
            result["skinsSummary"]["error"] = "库存为空或无法获取"
    except Exception as e:
        result["skinsSummary"]["error"] = f"库存获取失败: {str(e)}"
        result["inventoryAvailable"] = False

    try:
        store_catalog = fetch_rust_itemstore_catalog()
    except Exception as e:
        result["storeSummary"]["error"] = f"官方商城目录获取失败: {str(e)}"
        store_catalog = []

    # ────────────── 第二部分: DLC 扩展包 ──────────────
    try:
        # 1) 获取 Rust 的全部 DLC appid 列表
        dlc_ids = fetch_rust_dlc_list()
        
        # 2) 检测玩家拥有哪些 DLC
        owned_dlcs = check_dlc_ownership(set(dlc_ids), inv_data=inv_data)
        ownership_known = owned_dlcs is not None
        if not ownership_known:
            owned_dlcs = set()
            result["dlcOwnershipAvailable"] = False
            result["dlcSummary"]["error"] = "无法从公开库存确认 DLC 拥有状态"
        
        # 3) 获取每个 DLC 的详细信息
        for dlc_id in dlc_ids:
            details = fetch_dlc_details(dlc_id)
            known = RUST_DLCS.get(dlc_id, {})
            
            is_owned = (dlc_id in owned_dlcs) if ownership_known else None
            
            result["dlcs"].append({
                "appid": dlc_id,
                "name": details.get("name", f"DLC #{dlc_id}"),
                "nameCN": known.get("nameCN", details.get("name", "")),
                "category": known.get("category", "DLC"),
                "description": details.get("shortDescription", ""),
                "headerImage": details.get("headerImage", ""),
                "capsuleImage": details.get("capsuleImageV5") or details.get("capsuleImage", ""),
                "price": details.get("price", {}),
                "releaseDate": details.get("releaseDate", ""),
                "storeUrl": details.get("storeUrl", ""),
                "owned": is_owned,
                "source": "dlc",  # 标记来源
                # DLC 是永久绑定的, 不可交易
                "tradable": False,
                "marketable": False,
                "boundToAccount": True,
            })
            
            time.sleep(0.3)  # Store API 限速
    except Exception as e:
        result["dlcSummary"]["error"] = f"DLC 查询失败: {str(e)}"
        result["dlcOwnershipAvailable"] = False
    
    # ────────────── 汇总计算 ──────────────
    skins = result["skins"]
    dlcs = result["dlcs"]
    inventory_name_set = {normalize_item_name(item.get("name")) for item in skins}
    scmm_name_set = {normalize_item_name(item.get("name")) for item in scmm_inventory_items or []}

    for item in store_catalog:
        normalized_name = normalize_item_name(item.get("name"))
        item["owned"] = normalized_name in inventory_name_set if normalized_name else False
        item["scmmAvailable"] = normalized_name in scmm_name_set if normalized_name else False
    result["storeCatalog"] = store_catalog
    
    if inv_data and inv_data.get("assets"):
        inventory_item_count = int(inv_data.get("total_inventory_count") or sum(item.get("quantity", 1) for item in skins))
        if scmm_inventory_value:
            skin_total = round((scmm_inventory_value.get("marketValue") or 0) / 100, 2)
        else:
            skin_total = sum(s["price"] for s in skins) if result["inventoryAvailable"] else None
    elif scmm_inventory_value:
        skin_total = round((scmm_inventory_value.get("marketValue") or 0) / 100, 2)
        inventory_item_count = scmm_inventory_value.get("items", len(skins))
    else:
        skin_total = sum(s["price"] for s in skins) if result["inventoryAvailable"] else None
        inventory_item_count = len(skins)

    skin_tradable = sum(s["price"] for s in skins if s["tradable"]) if result["inventoryAvailable"] else None

    rarity_counts = {}
    for s in skins:
        r = s["rarity"]
        rarity_counts[r] = rarity_counts.get(r, 0) + (s.get("quantity", 1) or 1)
    
    owned_dlcs_list = [d for d in dlcs if d["owned"] is True]
    not_owned_dlcs = [d for d in dlcs if d["owned"] is False]
    unknown_dlcs = [d for d in dlcs if d["owned"] is None]
    dlc_value = sum(d["price"].get("final", 0) for d in owned_dlcs_list) if result["dlcOwnershipAvailable"] else None
    
    result["skinsSummary"] = {
        **result.get("skinsSummary", {}),
        "totalItems": inventory_item_count,
        "distinctItems": len(skins),
        "totalValue": round(skin_total, 2) if skin_total is not None else None,
        "tradableValue": round(skin_tradable, 2) if skin_tradable is not None else None,
        "rarityCounts": rarity_counts,
        "available": result["inventoryAvailable"],
        "source": "steam-web+scmm" if (inv_data and scmm_inventory_value) else ("steam-web" if inv_data else ("scmm-profile" if scmm_inventory_value else None)),
        "steamWebOnlyDistinct": len([item for item in skins if item.get("source") == "steam-web"]),
        "steamWebOnlyItems": sum(item.get("quantity", 1) for item in skins if item.get("source") == "steam-web"),
        "pricedByScmmDistinct": len([item for item in skins if item.get("priceSource") == "scmm-profile"]),
        "pricedByScmmItems": sum(item.get("quantity", 1) for item in skins if item.get("priceSource") == "scmm-profile"),
    }
    
    result["dlcSummary"] = {
        **result.get("dlcSummary", {}),
        "totalDlcs": len(dlcs),
        "ownedCount": len(owned_dlcs_list),
        "notOwnedCount": len(not_owned_dlcs),
        "unknownCount": len(unknown_dlcs),
        "ownedValue": round(dlc_value, 2) if dlc_value is not None else None,
        "available": result["dlcOwnershipAvailable"],
    }

    owned_store_items = [item for item in store_catalog if item.get("owned")]
    steam_only_store_items = [item for item in store_catalog if not item.get("scmmAvailable")]
    owned_store_value = round(sum(item.get("priceValue") or 0 for item in owned_store_items), 2) if store_catalog else 0
    result["storeSummary"] = {
        **result.get("storeSummary", {}),
        "totalItems": len(store_catalog),
        "ownedCount": len(owned_store_items),
        "notOwnedCount": len(store_catalog) - len(owned_store_items),
        "steamWebOnlyCount": len(steam_only_store_items),
        "ownedValue": owned_store_value,
        "available": bool(store_catalog),
    }
    
    combined_total = None
    if skin_total is not None or dlc_value is not None:
        combined_total = (skin_total or 0) + (dlc_value or 0)

    result["totalSummary"] = {
        "totalValue": round(combined_total, 2) if combined_total is not None else None,
        "skinsValue": round(skin_total, 2) if skin_total is not None else None,
        "dlcValue": round(dlc_value, 2) if dlc_value is not None else None,
        "tradableValue": round(skin_tradable, 2) if skin_tradable is not None else None,
        "totalItems": inventory_item_count,
        "distinctItems": len(skins),
        "totalDlcs": len(dlcs),
        "ownedDlcs": len(owned_dlcs_list),
        "unknownDlcs": len(unknown_dlcs),
        "storeCatalogItems": len(store_catalog),
        "ownedStoreItems": len(owned_store_items),
        "ownedStoreValue": owned_store_value,
        "currency": "USD",
    }
    
    # 按价格排序皮肤
    result["skins"].sort(key=lambda x: x["price"], reverse=True)
    # DLC: 已拥有在前, 未拥有在后
    result["dlcs"].sort(key=lambda x: (x["owned"] is not True, x["owned"] is None, -x["price"].get("final", 0)))
    
    return result


# ══════════════════════════════════════════════════════════
#  模块 3: 服务器时长
# ══════════════════════════════════════════════════════════

def search_bm_player(query):
    if not battlemetrics_token_set():
        raise ConfigurationError("BattleMetrics Token 未配置")
    url = "https://api.battlemetrics.com/players"
    headers = {"Authorization": f"Bearer {BATTLEMETRICS_TOKEN}"}
    data = cached_get(url, headers=headers, params={
        "filter[search]": query, "page[size]": 10
    })
    return [{
        "bmId": p["id"],
        "name": p.get("attributes", {}).get("name", ""),
        "lastSeen": p.get("attributes", {}).get("lastSeen"),
    } for p in data.get("data", [])]


def find_bm_candidates_for_player_ref(player_ref):
    raw = player_ref.strip().rstrip("/")
    if not raw:
        return {"steamId": None, "playerName": "", "candidates": []}

    steam_id = resolve_steam_id(raw)
    player_name = raw
    query_variants = [raw]

    if steam_id:
        summary = get_player_summary(steam_id)
        if summary:
            player_name = summary.get("name", "").strip() or raw
            query_variants = [player_name]
            normalized_name = normalize_bm_name(player_name)
            simplified_name = normalized_name.replace(" ", "")
            if normalized_name and normalized_name not in query_variants:
                query_variants.append(normalized_name)
            if simplified_name and simplified_name not in query_variants:
                query_variants.append(simplified_name)

    normalized_name = normalize_bm_name(player_name)
    simplified_name = normalized_name.replace(" ", "")

    seen = {}
    for query in query_variants:
        if not query:
            continue
        try:
            candidates = search_bm_player(query)
        except Exception as e:
            print(f"[WARN] BattleMetrics 搜索失败 {query}: {e}")
            continue
        for candidate in candidates[:10]:
            candidate = dict(candidate)
            candidate.setdefault("queryUsed", query)
            seen[candidate["bmId"]] = candidate

    name_scored_candidates = []
    for candidate in seen.values():
        candidate_name = candidate.get("name", "")
        normalized_candidate = normalize_bm_name(candidate_name)
        score = 0
        if candidate_name.casefold() == player_name.casefold():
            score += 100
        if normalized_candidate == normalized_name:
            score += 90
        if normalized_name and normalized_name in normalized_candidate:
            score += 50
        if simplified_name and simplified_name in normalized_candidate.replace(" ", ""):
            score += 40
        name_scored_candidates.append({
            **candidate,
            "score": score,
            "matchedSteamName": player_name,
            "matchedSteamId": steam_id,
        })

    name_scored_candidates.sort(
        key=lambda item: (
            item["score"],
            item["lastSeen"] or "",
        ),
        reverse=True,
    )

    preview_cap = 8
    scored_candidates = []
    for candidate in name_scored_candidates[:preview_cap]:
        preview = get_bm_session_preview(candidate["bmId"])
        scored_candidates.append({
            **candidate,
            "sessionPreview": preview,
        })

    scored_candidates.sort(
        key=lambda item: (
            1 if (item["sessionPreview"]["count"] > 0 or item["sessionPreview"]["hasMore"]) else 0,
            item["score"],
            item["sessionPreview"]["count"],
            item["lastSeen"] or "",
        ),
        reverse=True,
    )

    return {
        "steamId": steam_id,
        "playerName": player_name,
        "candidates": scored_candidates,
    }


def resolve_bm_player_id(player_ref):
    """
    将 BattleMetrics ID、Steam 标识或名称搜索词解析成 BattleMetrics player id。

    BattleMetrics 公开搜索更适合按名称查找，所以当输入是 Steam 标识时，
    这里先取 Steam 公开昵称，再做一次 BattleMetrics 名称搜索。
    """
    raw = player_ref.strip().rstrip("/")
    if not raw:
        return None

    if raw in _bm_resolution_cache:
        return _bm_resolution_cache[raw]

    # BattleMetrics player id 通常是较短纯数字；17 位数字优先按 SteamID64 处理。
    if raw.isdigit() and len(raw) != 17:
        return raw

    steam_id = resolve_steam_id(raw)
    if steam_id:
        candidate_payload = find_bm_candidates_for_player_ref(raw)
        resolved = candidate_payload["candidates"][0]["bmId"] if candidate_payload["candidates"] else None
        if resolved:
            _bm_resolution_cache[raw] = resolved
            _bm_resolution_cache[steam_id] = resolved
        return resolved

    candidates = search_bm_player(raw)
    if not candidates:
        return None
    _bm_resolution_cache[raw] = candidates[0]["bmId"]
    return candidates[0]["bmId"]


def get_player_servers(bm_player_id):
    if not battlemetrics_token_set():
        raise ConfigurationError("BattleMetrics Token 未配置")
    headers = {"Authorization": f"Bearer {BATTLEMETRICS_TOKEN}"}
    player_data = cached_get(
        f"https://api.battlemetrics.com/players/{bm_player_id}",
        headers=headers, params={"include": "server"}
    )
    
    server_map = {}
    next_url = f"https://api.battlemetrics.com/players/{bm_player_id}/relationships/sessions"
    
    for page in range(5):
        if not next_url:
            break
        sd = cached_get(next_url, headers=headers,
                        params={"page[size]": 100, "include": "server"} if page == 0 else None)
        
        server_info = {
            inc["id"]: inc.get("attributes", {})
            for inc in sd.get("included", []) if inc.get("type") == "server"
        }
        
        for sess in sd.get("data", []):
            a = sess.get("attributes", {})
            sid = sess.get("relationships", {}).get("server", {}).get("data", {}).get("id", "?")
            
            start = a.get("start")
            stop = a.get("stop")
            if start:
                s_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
                e_dt = datetime.fromisoformat(stop.replace("Z", "+00:00")) if stop else datetime.now(s_dt.tzinfo)
                hours = (e_dt - s_dt).total_seconds() / 3600
            else:
                hours = 0
            
            if sid not in server_map:
                si = server_info.get(sid, {})
                server_map[sid] = {
                    "serverId": sid,
                    "name": si.get("name", f"Server #{sid}"),
                    "country": si.get("country", "??"),
                    "status": si.get("status", "unknown"),
                    "players": f"{si.get('players', 0)}/{si.get('maxPlayers', 0)}",
                    "totalHours": 0, "sessionCount": 0,
                    "lastSeen": None, "firstSeen": None,
                }
            
            srv = server_map[sid]
            srv["totalHours"] += hours
            srv["sessionCount"] += 1
            if start and (not srv["lastSeen"] or start > srv["lastSeen"]):
                srv["lastSeen"] = start
        
        next_url = sd.get("links", {}).get("next")
    
    servers = sorted(server_map.values(), key=lambda x: x["totalHours"], reverse=True)
    for s in servers:
        s["totalHours"] = round(s["totalHours"], 1)
    
    total = sum(s["totalHours"] for s in servers)
    return {
        "servers": servers,
        "summary": {
            "totalHours": round(total, 1),
            "totalDays": round(total / 24, 1),
            "serverCount": len(servers),
            "totalSessions": sum(s["sessionCount"] for s in servers),
        }
    }


def rustoria_get(path, params=None, ttl=RUSTORIA_CACHE_TTL):
    return cached_get(f"{RUSTORIA_API_BASE}{path}", params=params, ttl=ttl)


def fetch_rustoria_servers():
    servers = rustoria_get("/servers", ttl=RUSTORIA_SERVER_TTL)
    return sorted(
        servers,
        key=lambda item: (
            not bool(item.get("leaderboardServer")),
            str(item.get("name", "")).casefold(),
        ),
    )


def fetch_rustoria_server_detail(server_id):
    return rustoria_get(f"/servers/find/{server_id}", ttl=RUSTORIA_SERVER_TTL)


def fetch_rustoria_statistic_mappings():
    return rustoria_get("/statistics/mappings", ttl=RUSTORIA_MAPPING_TTL)


def fetch_rustoria_wipes(server_id):
    return rustoria_get(f"/statistics/wipes/{server_id}", ttl=RUSTORIA_CACHE_TTL)


def fetch_rustoria_leaderboard(server_id, statistic_id, from_value=0, sort_by="total", order_by="desc", username="", wipe=""):
    params = {
        "from": max(0, int(from_value)),
        "sortBy": sort_by or "total",
        "orderBy": "asc" if str(order_by).lower() == "asc" else "desc",
        "username": username or "",
        "wipe": wipe or "",
    }
    return rustoria_get(
        f"/statistics/leaderboards/{server_id}/{statistic_id}",
        params=params,
        ttl=RUSTORIA_CACHE_TTL,
    )


def fetch_rustoria_leaderboard_totals(server_id, statistic_id, wipe=""):
    return rustoria_get(
        f"/statistics/leaderboard-totals/{server_id}/{statistic_id}",
        params={"wipe": wipe or ""},
        ttl=RUSTORIA_CACHE_TTL,
    )


def extract_rustoria_composition_fields(composition):
    return RUSTORIA_COMPOSITION_RE.findall(composition or "")


def humanize_rustoria_field(field_id):
    if field_id in RUSTORIA_SPECIAL_FIELD_NAMES:
        return RUSTORIA_SPECIAL_FIELD_NAMES[field_id]

    words = []
    for part in str(field_id or "").split("_"):
        if not part:
            continue
        if part.upper() in {"PVP", "PVE", "KDR", "HQM"}:
            words.append(part.upper())
        else:
            words.append(part.capitalize())
    return " ".join(words) or field_id


def rustoria_field_kind(field_id):
    if field_id in RUSTORIA_PERCENT_FIELDS:
        return "percent"
    if field_id in RUSTORIA_RATIO_FIELDS:
        return "ratio"
    if field_id in RUSTORIA_DURATION_FIELDS:
        return "duration"
    return "number"


def build_rustoria_field_meta(field_id, mappings):
    mapping = mappings.get(field_id, {})
    return {
        "id": field_id,
        "name": mapping.get("name") or humanize_rustoria_field(field_id),
        "image": mapping.get("image"),
        "kind": rustoria_field_kind(field_id),
    }


def dedupe_preserve(items):
    seen = set()
    ordered = []
    for item in items:
        if item in seen or item is None:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered


def build_rustoria_field_ids(statistic, totals=None, leaderboard_rows=None):
    composition_fields = extract_rustoria_composition_fields(statistic.get("composition"))
    sample_keys = []

    if leaderboard_rows:
        for row in leaderboard_rows:
            data = row.get("data") or {}
            sample_keys.extend(list(data.keys()))
            if sample_keys:
                break

    field_totals = (totals or {}).get("fieldTotals") or {}
    sample_keys.extend(list(field_totals.keys()))

    extras = [key for key in sample_keys if key not in composition_fields]
    preferred_prefix = [key for key in ("kdr", "accuracy") if key in extras]
    trailing = [key for key in extras if key not in preferred_prefix]
    return dedupe_preserve(preferred_prefix + composition_fields + trailing)


def serialize_rustoria_statistic(statistic, mappings, field_ids=None):
    field_ids = field_ids or extract_rustoria_composition_fields(statistic.get("composition"))
    return {
        "id": statistic.get("id"),
        "name": statistic.get("name"),
        "display": statistic.get("display"),
        "order": statistic.get("order"),
        "defaultSort": statistic.get("default_sort"),
        "composition": statistic.get("composition"),
        "fields": [build_rustoria_field_meta(field_id, mappings) for field_id in field_ids],
    }


def find_rustoria_statistic(server_detail, statistic_id):
    for statistic in server_detail.get("statistics", []):
        if statistic.get("id") == statistic_id:
            return statistic
    return None


def serialize_rustoria_server(server):
    return {
        "id": server.get("id"),
        "name": server.get("name"),
        "leaderboardServer": bool(server.get("leaderboardServer")),
        "image": server.get("image"),
        "bannerImage": server.get("bannerImage"),
        "serverType": server.get("serverType"),
        "groupLimit": server.get("groupLimit"),
        "excludeGroupRules": server.get("excludeGroupRules"),
        "gatherRate": server.get("gatherRate"),
        "region": server.get("region"),
    }


def fetch_rustoria_player_summary(server_id, username, wipe=""):
    server_detail = fetch_rustoria_server_detail(server_id)
    mappings = fetch_rustoria_statistic_mappings()
    username_cf = username.casefold()
    statistics = []
    identity = None

    for statistic in sorted(server_detail.get("statistics", []), key=lambda item: item.get("order") or 999):
        payload = fetch_rustoria_leaderboard(
            server_id=server_id,
            statistic_id=statistic.get("id"),
            from_value=0,
            sort_by=statistic.get("default_sort") or "total",
            order_by="desc",
            username=username,
            wipe=wipe,
        )
        rows = payload.get("leaderboard", []) or []
        exact_matches = [row for row in rows if str(row.get("username", "")).casefold() == username_cf]
        selected_match = exact_matches[0] if exact_matches else (rows[0] if rows else None)
        field_ids = build_rustoria_field_ids(statistic, leaderboard_rows=[selected_match] if selected_match else rows)
        statistics.append({
            "statistic": serialize_rustoria_statistic(statistic, mappings, field_ids),
            "matchCount": len(rows),
            "exactMatchCount": len(exact_matches),
            "selectedMatch": selected_match,
            "matches": rows[:5],
        })
        if selected_match and not identity:
            identity = {
                "rustoriaId": selected_match.get("rustoriaId"),
                "username": selected_match.get("username"),
                "avatar": selected_match.get("avatar"),
                "private": selected_match.get("private"),
            }

    return {
        "server": serialize_rustoria_server(server_detail),
        "identity": identity,
        "statistics": statistics,
        "matchedStatistics": sum(1 for item in statistics if item.get("selectedMatch")),
    }


def collapse_whitespace(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def slugify_label(value):
    slug = re.sub(r"[^a-z0-9]+", "-", collapse_whitespace(value).casefold()).strip("-")
    return slug or "item"


def numeric_value(value):
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric != numeric:
        return None
    return numeric


def build_moose_named_item(name, active=False, extra=None):
    payload = {
        "id": slugify_label(name),
        "name": collapse_whitespace(name),
        "active": bool(active),
    }
    if extra:
        payload.update(extra)
    return payload


def ensure_playwright_available():
    if sync_playwright is None:
        raise RuntimeError("当前环境缺少 Playwright，无法抓取 Moose 数据")


SURVIVORS_CATEGORY_SPECS = [
    {
        "id": "overall",
        "name": "OVERALL",
        "sortBy": "rating_total",
        "fields": [
            {"id": "time_played", "name": "Time Played", "kind": "duration"},
            {"id": "rating_pvp", "name": "PvP Rating", "kind": "number"},
            {"id": "rating_events", "name": "Events Rating", "kind": "number"},
            {"id": "rating_gather", "name": "Gather Rating", "kind": "number"},
            {"id": "rating_explosives", "name": "Explosives Rating", "kind": "number"},
            {"id": "rating_pve", "name": "PvE Rating", "kind": "number"},
            {"id": "rating_total", "name": "Total Rating", "kind": "number"},
        ],
    },
    {
        "id": "pvp",
        "name": "PVP",
        "sortBy": "rating_pvp",
        "fields": [
            {"id": "kills", "name": "Kills", "kind": "number"},
            {"id": "deaths", "name": "Deaths", "kind": "number"},
            {"id": "kdr", "name": "K/D", "kind": "ratio"},
            {"id": "accuracy", "name": "Accuracy", "kind": "percent"},
            {"id": "hs_accuracy", "name": "HS Accuracy", "kind": "percent"},
            {"id": "longest_kill", "name": "Longest Kill", "kind": "number"},
            {"id": "player_damage", "name": "Damage", "kind": "number"},
            {"id": "bullets_fired", "name": "Bullets Fired", "kind": "number"},
            {"id": "combat_effectiveness", "name": "Effectiveness", "kind": "number"},
            {"id": "preferred_weapon", "name": "Preferred Weapon", "kind": "text"},
            {"id": "rating_pvp", "name": "PvP Rating", "kind": "number"},
        ],
    },
    {
        "id": "events",
        "name": "EVENTS",
        "sortBy": "rating_events",
        "fields": [
            {"id": "cargo_ship", "name": "Cargo Ship", "kind": "number"},
            {"id": "oil_rig_large", "name": "Oil Rig Large", "kind": "number"},
            {"id": "oil_rig_small", "name": "Oil Rig Small", "kind": "number"},
            {"id": "bradley", "name": "Bradley Kills", "kind": "number"},
            {"id": "bradley_damage", "name": "Bradley Damage", "kind": "number"},
            {"id": "attack_heli", "name": "Attack Heli Kills", "kind": "number"},
            {"id": "attack_heli_damage", "name": "Attack Heli Damage", "kind": "number"},
            {"id": "keycard_green", "name": "Green Keycard", "kind": "number"},
            {"id": "keycard_blue", "name": "Blue Keycard", "kind": "number"},
            {"id": "keycard_red", "name": "Red Keycard", "kind": "number"},
            {"id": "rating_events", "name": "Events Rating", "kind": "number"},
        ],
    },
    {
        "id": "gathering",
        "name": "GATHERING",
        "sortBy": "rating_gather",
        "fields": [
            {"id": "gather_wood", "name": "Wood", "kind": "number"},
            {"id": "gather_stone", "name": "Stone", "kind": "number"},
            {"id": "gather_metal", "name": "Metal", "kind": "number"},
            {"id": "gather_sulfur", "name": "Sulfur", "kind": "number"},
            {"id": "gather_hqm", "name": "HQM", "kind": "number"},
            {"id": "gather_scrap", "name": "Scrap", "kind": "number"},
            {"id": "rating_gather", "name": "Harvest Rating", "kind": "number"},
        ],
    },
    {
        "id": "farming",
        "name": "FARMING",
        "sortBy": "rating_gather",
        "fields": [
            {"id": "farming_corn", "name": "Corn", "kind": "number"},
            {"id": "farming_pumpkin", "name": "Pumpkin", "kind": "number"},
            {"id": "farming_potato", "name": "Potato", "kind": "number"},
            {"id": "farming_berry", "name": "Berry", "kind": "number"},
            {"id": "farming_hemp", "name": "Hemp", "kind": "number"},
            {"id": "rating_gather", "name": "Harvest Rating", "kind": "number"},
        ],
    },
    {
        "id": "explosives",
        "name": "EXPLOSIVES",
        "sortBy": "rating_explosives",
        "fields": [
            {"id": "explosives_c4", "name": "C4", "kind": "number"},
            {"id": "explosives_satchel", "name": "Satchels", "kind": "number"},
            {"id": "explosives_beancan", "name": "Beancans", "kind": "number"},
            {"id": "explosives_f1grenade", "name": "F1 Grenades", "kind": "number"},
            {"id": "explosives_rocket", "name": "Rockets", "kind": "number"},
            {"id": "explosives_hvrocket", "name": "HV Rockets", "kind": "number"},
            {"id": "explosives_incendiaryrocket", "name": "Incendiary Rockets", "kind": "number"},
            {"id": "explosives_ammo", "name": "Explosive Ammo", "kind": "number"},
            {"id": "rating_explosives", "name": "Explosives Rating", "kind": "number"},
        ],
    },
    {
        "id": "pve-npc",
        "name": "PVE NPC",
        "sortBy": "rating_pve",
        "fields": [
            {"id": "scientist", "name": "Scientist", "kind": "number"},
            {"id": "scientist_oilrig", "name": "Oil Rig Scientist", "kind": "number"},
            {"id": "scientist_heavy", "name": "Heavy Scientist", "kind": "number"},
            {"id": "scientist_excavator", "name": "Excavator Scientist", "kind": "number"},
            {"id": "scientist_cargo", "name": "Cargo Scientist", "kind": "number"},
            {"id": "scientist_ch47", "name": "CH47 Scientist", "kind": "number"},
            {"id": "scientist_junkpile", "name": "Junkpile Scientist", "kind": "number"},
            {"id": "tunnel_dweller", "name": "Tunnel Dweller", "kind": "number"},
            {"id": "rating_pve", "name": "PvE Rating", "kind": "number"},
        ],
    },
    {
        "id": "pve-animal",
        "name": "PVE ANIMAL",
        "sortBy": "rating_pve",
        "fields": [
            {"id": "animals_total", "name": "Animals", "kind": "number"},
            {"id": "bear", "name": "Bear", "kind": "number"},
            {"id": "boar", "name": "Boar", "kind": "number"},
            {"id": "wolf", "name": "Wolf", "kind": "number"},
            {"id": "horse", "name": "Horse", "kind": "number"},
            {"id": "chicken", "name": "Chicken", "kind": "number"},
            {"id": "deer", "name": "Deer", "kind": "number"},
            {"id": "crocodile", "name": "Crocodile", "kind": "number"},
            {"id": "tiger", "name": "Tiger", "kind": "number"},
            {"id": "panther", "name": "Panther", "kind": "number"},
            {"id": "snake", "name": "Snake", "kind": "number"},
            {"id": "rating_pve", "name": "PvE Rating", "kind": "number"},
        ],
    },
    {
        "id": "gambling",
        "name": "GAMBLING",
        "sortBy": "gambling_total_won",
        "fields": [
            {"id": "gambling_blackjack_won", "name": "Blackjack Won", "kind": "number"},
            {"id": "gambling_blackjack_bet", "name": "Blackjack Bet", "kind": "number"},
            {"id": "gambling_slots_won", "name": "Slots Won", "kind": "number"},
            {"id": "gambling_slots_bet", "name": "Slots Bet", "kind": "number"},
            {"id": "gambling_poker_won", "name": "Poker Won", "kind": "number"},
            {"id": "gambling_poker_bet", "name": "Poker Bet", "kind": "number"},
            {"id": "gambling_wheel_won", "name": "Wheel Won", "kind": "number"},
            {"id": "gambling_wheel_bet", "name": "Wheel Bet", "kind": "number"},
            {"id": "gambling_total_won", "name": "Total Won", "kind": "number"},
        ],
    },
]
SURVIVORS_CATEGORY_LOOKUP = {item["id"]: item for item in SURVIVORS_CATEGORY_SPECS}
SURVIVORS_PERIODS = [
    {"id": "wipe", "name": "Current Wipe"},
    {"id": "lifetime", "name": "Lifetime"},
]


@contextmanager
def moose_page_session():
    ensure_playwright_available()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 2400})
        try:
            page.goto(MOOSE_STATS_URL, wait_until="domcontentloaded", timeout=120000)
            page.wait_for_timeout(MOOSE_BOOT_DELAY_MS)
            page.locator("table").first.wait_for(timeout=120000)
            yield page
        finally:
            browser.close()


def get_combobox(page, index):
    combobox = page.get_by_role("combobox").nth(index)
    combobox.wait_for(timeout=30000)
    return combobox


def moose_option_locator(page, controls_id):
    escaped_id = str(controls_id).replace("\\", "\\\\").replace('"', '\\"')
    return page.locator(f'[id="{escaped_id}"] [role="option"]')


def moose_get_dropdown_options(page, combobox_index):
    combobox = get_combobox(page, combobox_index)
    if combobox.get_attribute("aria-disabled") == "true":
        return []
    options = []
    deadline = time.time() + 8
    while time.time() < deadline:
        combobox.click()
        page.wait_for_timeout(250)
        controls_id = combobox.get_attribute("aria-controls")
        if not controls_id:
            page.keyboard.press("Escape")
            continue
        options = [
            collapse_whitespace(text)
            for text in moose_option_locator(page, controls_id).all_inner_texts()
        ]
        options = [option for option in options if option]
        if options:
            break
        page.keyboard.press("Escape")
    page.keyboard.press("Escape")
    return options


def moose_select_dropdown_value(page, combobox_index, option_name):
    target = collapse_whitespace(option_name)
    combobox = get_combobox(page, combobox_index)
    current_label = collapse_whitespace(combobox.inner_text())
    if current_label == target:
        return current_label
    controls_id = combobox.get_attribute("aria-controls")
    if not controls_id:
        raise RuntimeError("Moose 下拉菜单结构异常")
    combobox.click()
    page.wait_for_timeout(250)
    option = moose_option_locator(page, controls_id).get_by_text(target, exact=True)
    option.wait_for(timeout=5000)
    option.click()
    page.wait_for_timeout(MOOSE_INTERACTION_DELAY_MS)
    return collapse_whitespace(get_combobox(page, combobox_index).inner_text())


def moose_active_server_name(page):
    return collapse_whitespace(get_combobox(page, 0).inner_text()) or "Global"


def moose_active_period_name(page):
    return collapse_whitespace(get_combobox(page, 1).inner_text()) or "All Time"


def dedupe_named_items(items):
    seen = set()
    ordered = []
    for item in items:
        item_id = item.get("id")
        if not item_id or item_id in seen:
            continue
        seen.add(item_id)
        ordered.append(item)
    return ordered


def fetch_moose_catalog():
    def builder():
        with moose_page_session() as page:
            servers = [{"id": "global", "name": "Global", "active": True}]
            servers.extend(
                build_moose_named_item(name)
                for name in moose_get_dropdown_options(page, 0)
            )
            categories = [
                build_moose_named_item(name)
                for name in page.get_by_role("tab").all_inner_texts()
                if collapse_whitespace(name)
            ]
            return {
                "source": MOOSE_STATS_URL,
                "servers": dedupe_named_items(servers),
                "categories": dedupe_named_items(categories),
            }

    return cached_compute("moose:catalog", MOOSE_META_TTL, builder)


def resolve_named_item(item_id, items, item_label):
    lookup = collapse_whitespace(item_id).casefold()
    for item in items:
        if str(item.get("id", "")).casefold() == lookup or str(item.get("name", "")).casefold() == lookup:
            return item
    raise KeyError(f"找不到该 Moose {item_label}")


def moose_collect_periods(page):
    periods = [build_moose_named_item("All Time", active=moose_active_period_name(page) == "All Time")]
    periods.extend(
        build_moose_named_item(name, active=(name == moose_active_period_name(page)))
        for name in moose_get_dropdown_options(page, 1)
    )
    return dedupe_named_items(periods)


def fetch_moose_server_detail(server_id):
    catalog = fetch_moose_catalog()
    server = resolve_named_item(server_id, catalog["servers"], "服务器")

    def builder():
        with moose_page_session() as page:
            if server["name"] != "Global":
                moose_select_dropdown_value(page, 0, server["name"])
            return {
                "server": {
                    **server,
                    "active": True,
                },
                "periods": moose_collect_periods(page),
                "categories": catalog["categories"],
            }

    return cached_compute(f"moose:server-detail:{server['id']}", MOOSE_CACHE_TTL, builder)


def moose_select_server(page, server):
    if server["name"] == "Global":
        return "Global"
    return moose_select_dropdown_value(page, 0, server["name"])


def resolve_moose_period(period_value, periods):
    if not period_value:
        return periods[0]
    lookup = collapse_whitespace(period_value).casefold()
    for period in periods:
        if str(period.get("id", "")).casefold() == lookup or str(period.get("name", "")).casefold() == lookup:
            return period
    raise KeyError("找不到该时间范围")


def moose_select_period(page, period):
    if period["name"] == "All Time":
        return "All Time"
    return moose_select_dropdown_value(page, 1, period["name"])


def moose_select_category(page, category):
    tabs = page.locator("[role='tab']")
    target_id = category["id"]
    for index in range(tabs.count()):
        tab = tabs.nth(index)
        if slugify_label(tab.inner_text()) == target_id:
            tab.click()
            page.wait_for_timeout(MOOSE_INTERACTION_DELAY_MS)
            return
    raise KeyError(f"找不到该 Moose 统计类型: {category['name']}")


def moose_search_player(page, player_name):
    search_box = page.get_by_placeholder("Search...")
    search_box.fill("")
    page.wait_for_timeout(200)
    if player_name:
        search_box.fill(player_name)
        page.wait_for_timeout(300)
        search_box.press("Enter")
    page.wait_for_timeout(MOOSE_INTERACTION_DELAY_MS)


def parse_moose_steam_id(url):
    if not url:
        return None
    match = re.search(r"/profiles/(\d+)", url)
    return match.group(1) if match else None


def serialize_moose_field(header):
    return {
        "id": slugify_label(header),
        "name": collapse_whitespace(header),
        "kind": "text",
    }


def moose_current_page(page):
    active_button = page.locator("button.rz-pager-page.rz-state-active")
    if active_button.count() == 0:
        return 1
    try:
        return int(collapse_whitespace(active_button.first.inner_text()) or "1")
    except ValueError:
        return 1


def moose_click_pager(page, aria_label):
    button = page.get_by_role("button", name=aria_label)
    if button.count() == 0:
        return False
    classes = button.first.get_attribute("class") or ""
    if "rz-state-disabled" in classes:
        return False
    button.first.click()
    page.wait_for_timeout(MOOSE_INTERACTION_DELAY_MS)
    return True


def moose_pager_enabled(page, aria_label):
    button = page.get_by_role("button", name=aria_label)
    if button.count() == 0:
        return False
    classes = button.first.get_attribute("class") or ""
    return "rz-state-disabled" not in classes


def moose_go_to_page(page, target_page):
    target = max(1, int(target_page or 1))
    direct_button = page.get_by_role("button", name=f"Go to page {target}.")
    if direct_button.count():
        classes = direct_button.first.get_attribute("class") or ""
        if "rz-state-active" not in classes:
            direct_button.first.click()
            page.wait_for_timeout(MOOSE_INTERACTION_DELAY_MS)
        return moose_current_page(page)

    current = moose_current_page(page)
    guard = 0
    while current < target and guard < 200:
        if not moose_click_pager(page, "Go to next page."):
            break
        next_page = moose_current_page(page)
        if next_page == current:
            break
        current = next_page
        guard += 1
    while current > target and guard < 400:
        if not moose_click_pager(page, "Go to previous page."):
            break
        prev_page = moose_current_page(page)
        if prev_page == current:
            break
        current = prev_page
        guard += 1
    return current


def moose_visible_pages(page):
    visible = []
    buttons = page.locator("button.rz-pager-page")
    for index in range(buttons.count()):
        button = buttons.nth(index)
        label = collapse_whitespace(button.inner_text())
        if not label:
            continue
        visible.append({
            "page": int(label),
            "active": "rz-state-active" in (button.get_attribute("class") or ""),
        })
    return visible


def moose_extract_table(page, page_number):
    headers = [collapse_whitespace(text) for text in page.locator("table thead th").all_inner_texts()]
    fields = [serialize_moose_field(header) for header in headers[1:]]
    rows = []
    table_rows = page.locator("table tbody tr")

    for index in range(table_rows.count()):
        row = table_rows.nth(index)
        texts = [collapse_whitespace(text) for text in row.locator("td").all_inner_texts()]
        texts = [text for text in texts if text]
        if not texts:
            continue
        if len(texts) == 1 and texts[0].casefold() == "no items to display.":
            continue

        player_cell = row.locator("td").nth(0)
        player_link = player_cell.locator("a")
        player_image = player_cell.locator("img")
        player_url = player_link.first.get_attribute("href") if player_link.count() else None
        avatar = player_image.first.get_attribute("src") if player_image.count() else None
        values = {
            field["id"]: texts[field_index + 1] if field_index + 1 < len(texts) else ""
            for field_index, field in enumerate(fields)
        }
        rows.append({
            "rank": (page_number - 1) * 25 + len(rows) + 1,
            "playerName": texts[0],
            "avatar": avatar,
            "playerUrl": player_url,
            "steamId": parse_moose_steam_id(player_url),
            "values": values,
        })

    return {
        "headers": headers,
        "fields": fields,
        "rows": rows,
        "pagination": {
            "currentPage": moose_current_page(page),
            "visiblePages": moose_visible_pages(page),
            "hasPrevious": moose_pager_enabled(page, "Go to previous page."),
            "hasNext": moose_pager_enabled(page, "Go to next page."),
            "pageSize": len(rows),
        },
    }


def fetch_moose_leaderboard(server_id, category_id, period_value="", search="", page_number=1):
    catalog = fetch_moose_catalog()
    server = resolve_named_item(server_id, catalog["servers"], "服务器")
    category = resolve_named_item(category_id, catalog["categories"], "统计类型")
    normalized_search = collapse_whitespace(search)

    def builder():
        with moose_page_session() as page:
            moose_select_server(page, server)
            periods = moose_collect_periods(page)
            period = resolve_moose_period(period_value, periods)
            if period["name"] != "All Time":
                moose_select_period(page, period)
            moose_select_category(page, category)
            if normalized_search:
                moose_search_player(page, normalized_search)
            current_page = moose_go_to_page(page, page_number)
            table = moose_extract_table(page, current_page)
            return {
                "server": {**server, "active": True},
                "category": category,
                "period": period,
                "fields": table["fields"],
                "headers": table["headers"],
                "rows": table["rows"],
                "pagination": table["pagination"],
                "query": {
                    "serverId": server["id"],
                    "categoryId": category["id"],
                    "period": period["name"],
                    "search": normalized_search,
                    "page": current_page,
                },
            }

    cache_key = f"moose:leaderboard:{server['id']}:{category['id']}:{slugify_label(period_value or 'all-time')}:{slugify_label(normalized_search or 'all')}:{int(page_number or 1)}"
    return cached_compute(cache_key, MOOSE_CACHE_TTL, builder)


def fetch_moose_player_summary(server_id, username, period_value=""):
    catalog = fetch_moose_catalog()
    server = resolve_named_item(server_id, catalog["servers"], "服务器")
    normalized_username = collapse_whitespace(username)
    if not normalized_username:
        raise ValueError("请提供玩家名称")

    def builder():
        with moose_page_session() as page:
            moose_select_server(page, server)
            periods = moose_collect_periods(page)
            period = resolve_moose_period(period_value, periods)
            if period["name"] != "All Time":
                moose_select_period(page, period)

            categories = []
            identity = None

            for index, category in enumerate(catalog["categories"]):
                moose_select_category(page, category)
                if index == 0:
                    moose_search_player(page, normalized_username)
                else:
                    page.wait_for_timeout(MOOSE_INTERACTION_DELAY_MS)
                table = moose_extract_table(page, 1)
                exact_matches = [
                    row for row in table["rows"]
                    if row.get("playerName", "").casefold() == normalized_username.casefold()
                ]
                selected_match = exact_matches[0] if exact_matches else (table["rows"][0] if table["rows"] else None)
                categories.append({
                    "category": category,
                    "fields": table["fields"],
                    "matchCount": len(table["rows"]),
                    "exactMatchCount": len(exact_matches),
                    "selectedMatch": selected_match,
                    "matches": table["rows"][:5],
                })
                if selected_match and not identity:
                    identity = {
                        "playerName": selected_match.get("playerName"),
                        "avatar": selected_match.get("avatar"),
                        "playerUrl": selected_match.get("playerUrl"),
                        "steamId": selected_match.get("steamId"),
                    }

            return {
                "server": {**server, "active": True},
                "period": period,
                "identity": identity,
                "categories": categories,
                "matchedCategories": sum(1 for item in categories if item.get("selectedMatch")),
            }

    cache_key = f"moose:player:{server['id']}:{slugify_label(period_value or 'all-time')}:{slugify_label(normalized_username)}"
    return cached_compute(cache_key, MOOSE_CACHE_TTL, builder)


@contextmanager
def survivors_page_session():
    ensure_playwright_available()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1600, "height": 2400},
            locale="en-US",
            user_agent=SURVIVORS_USER_AGENT,
        )
        page = context.new_page()
        try:
            yield page
        finally:
            context.close()
            browser.close()


def survivors_stats_response_predicate(response):
    return response.status == 200 and "/leaderboards/stats" in response.url


def extract_survivors_error(page):
    body_text = collapse_whitespace(page.locator("body").inner_text())
    for message in [
        "Error: An unexpected error occurred.",
        "You have been temporarily banned.",
        "Access Denied.",
    ]:
        if message in body_text:
            return message
    return ""


def survivors_open_catalog(page):
    captured = {"init": None, "servers": None}

    def handle_response(response):
        if response.status != 200:
            return
        if response.url == f"{SURVIVORS_API_BASE}/init" and captured["init"] is None:
            captured["init"] = response
        elif "/apis/public/servers?" in response.url and captured["servers"] is None:
            captured["servers"] = response

    page.on("response", handle_response)
    page.goto(SURVIVORS_URL, wait_until="domcontentloaded", timeout=60000)

    deadline = time.time() + (SURVIVORS_CATALOG_TIMEOUT_MS / 1000)
    while time.time() < deadline:
        visible_error = extract_survivors_error(page)
        if visible_error:
            raise RuntimeError(visible_error)
        if captured["init"] is not None and captured["servers"] is not None:
            page.wait_for_timeout(SURVIVORS_BOOT_DELAY_MS)
            return captured["init"].json(), captured["servers"].json()
        page.wait_for_timeout(500)

    visible_error = extract_survivors_error(page)
    if visible_error:
        raise RuntimeError(visible_error)
    raise PlaywrightTimeoutError("Survivors leaderboard catalog did not finish loading")


def survivors_avatar_url(user_payload):
    avatar_hash = (user_payload or {}).get("avatar_hash")
    if not avatar_hash:
        return ""
    return f"https://avatars.steamstatic.com/{avatar_hash}_full.jpg"


def survivors_period_options(active_mode="wipe"):
    normalized = "lifetime" if str(active_mode).strip().casefold() == "lifetime" else "wipe"
    return [
        {**item, "active": item["id"] == normalized}
        for item in SURVIVORS_PERIODS
    ]


def survivors_mode_button_label(mode_value):
    normalized = str(mode_value or "").strip().casefold()
    if normalized == "lifetime":
        return "Lifetime"
    if normalized == "teams":
        return "Teams"
    return "Current Wipe"


def normalize_survivors_mode(mode_value):
    normalized = str(mode_value or "").strip().casefold()
    if normalized == "lifetime":
        return "lifetime"
    if normalized == "teams":
        return "teams"
    return "wipe"


def serialize_survivors_server(server, active=False, index=None):
    return {
        "id": server.get("id") or slugify_label(server.get("title") or server.get("tag") or "server"),
        "name": collapse_whitespace(server.get("title") or server.get("tag") or "Unknown"),
        "tag": collapse_whitespace(server.get("tag") or ""),
        "address": server.get("address"),
        "port": server.get("port"),
        "players": server.get("players"),
        "maxPlayers": server.get("max_players"),
        "queue": server.get("queue"),
        "teamLimit": server.get("team_limit"),
        "lastWipe": server.get("last_wipe"),
        "gatherRate": server.get("gather_rate"),
        "region": collapse_whitespace(server.get("region") or "").upper(),
        "active": bool(active),
        "position": index,
    }


def serialize_survivors_category(category):
    return {
        "id": category["id"],
        "name": category["name"],
        "active": False,
        "defaultSort": category["sortBy"],
        "fields": [dict(field) for field in category["fields"]],
    }


def survivors_resolve_category(category_id):
    lookup = slugify_label(category_id)
    if lookup not in SURVIVORS_CATEGORY_LOOKUP:
        raise KeyError("找不到该 Survivors 统计类型")
    return SURVIVORS_CATEGORY_LOOKUP[lookup]


def survivors_collect_categories():
    return [serialize_survivors_category(item) for item in SURVIVORS_CATEGORY_SPECS]


def fetch_survivors_catalog():
    def builder():
        with survivors_page_session() as page:
            _, servers_payload = survivors_open_catalog(page)
        servers = [
            serialize_survivors_server(server, active=(index == 0), index=index)
            for index, server in enumerate(servers_payload.get("results", []) or [])
        ]
        return {
            "source": SURVIVORS_URL,
            "servers": servers,
            "categories": survivors_collect_categories(),
        }

    return cached_compute("survivors:catalog", SURVIVORS_META_TTL, builder)


def find_survivors_server(server_id):
    catalog = fetch_survivors_catalog()
    return resolve_named_item(server_id, catalog["servers"], "服务器")


def survivors_click_server_mode(page, server, button_label):
    position = server.get("position")
    if position is not None:
        buttons = page.get_by_role("button", name=button_label)
        if buttons.count() > position:
            buttons.nth(position).click()
            return

    aliases = [
        collapse_whitespace(server.get("name")),
        collapse_whitespace(server.get("tag")),
    ]
    aliases = [item for item in aliases if item]
    if not aliases:
        raise KeyError("Survivors 服务器信息不完整")

    clicked = page.evaluate(
        """
        ({ aliases, buttonLabel }) => {
          const normalize = (value) => String(value || "").replace(/\\s+/g, " ").trim();
          const candidates = Array.from(document.querySelectorAll("*"));
          for (const alias of aliases) {
            const target = candidates.find((node) => normalize(node.textContent) === normalize(alias));
            if (!target) continue;
            let container = target;
            while (container) {
              const button = Array.from(container.querySelectorAll("button")).find(
                (item) => normalize(item.textContent) === normalize(buttonLabel)
              );
              if (button) {
                button.click();
                return true;
              }
              container = container.parentElement;
            }
          }
          return false;
        }
        """,
        {"aliases": aliases, "buttonLabel": button_label},
    )
    if not clicked:
        raise KeyError("找不到该 Survivors 服务器或模式按钮")


def survivors_open_server(page, server, mode_value="wipe"):
    button_label = survivors_mode_button_label(mode_value)
    with page.expect_response(lambda response: response.status == 200 and response.url == f"{SURVIVORS_API_BASE}/server", timeout=120000) as server_info, \
         page.expect_response(survivors_stats_response_predicate, timeout=120000) as stats_info:
        survivors_click_server_mode(page, server, button_label)
    page.wait_for_timeout(SURVIVORS_INTERACTION_DELAY_MS)
    return server_info.value.json(), stats_info.value.json()


def survivors_search_player(page, search_value):
    query = collapse_whitespace(search_value)
    search_box = page.get_by_role("textbox", name="Search player by Name or Steam ID")
    search_box.wait_for(timeout=30000)
    with page.expect_response(survivors_stats_response_predicate, timeout=120000) as stats_info:
        search_box.fill(query)
        search_box.press("Enter")
    page.wait_for_timeout(SURVIVORS_INTERACTION_DELAY_MS)
    return stats_info.value.json()


def survivors_pager_enabled(page, label):
    button = page.get_by_role("button", name=label)
    if button.count() == 0:
        return False
    return button.first.is_enabled()


def survivors_go_to_page(page, page_number):
    target = max(1, int(page_number or 1))
    if target == 1:
        return None

    direct_button = page.get_by_role("button", name=f"Go to page {target}")
    if direct_button.count():
        with page.expect_response(survivors_stats_response_predicate, timeout=120000) as stats_info:
            direct_button.first.click()
        page.wait_for_timeout(SURVIVORS_INTERACTION_DELAY_MS)
        return stats_info.value.json()

    latest_payload = None
    for _ in range(1, target):
        next_button = page.get_by_role("button", name="Next page")
        if next_button.count() == 0 or not next_button.first.is_enabled():
            break
        with page.expect_response(survivors_stats_response_predicate, timeout=120000) as stats_info:
            next_button.first.click()
        latest_payload = stats_info.value.json()
        page.wait_for_timeout(SURVIVORS_INTERACTION_DELAY_MS)
    return latest_payload


def survivors_preferred_weapon(row):
    weapon_stats = row.get("weapon_stats") or {}
    excluded = {"id", "user_id", "server_id", "organization_id"}
    top_item = None
    top_value = 0
    for key, value in weapon_stats.items():
        if key in excluded:
            continue
        numeric = numeric_value(value)
        if numeric is None or numeric <= 0:
            continue
        if numeric > top_value:
            top_item = key
            top_value = numeric
    if not top_item:
        return ""
    return collapse_whitespace(top_item.replace("_", " ").upper())


def survivors_category_value(row, field_id):
    if field_id == "kdr":
        kills = numeric_value(row.get("kills")) or 0
        deaths = numeric_value(row.get("deaths")) or 0
        return kills if deaths <= 0 else round(kills / deaths, 2)
    if field_id == "animals_total":
        return sum(
            int(numeric_value(row.get(name)) or 0)
            for name in ["bear", "boar", "wolf", "horse", "chicken", "deer", "crocodile", "tiger", "panther", "snake"]
        )
    if field_id == "preferred_weapon":
        return survivors_preferred_weapon(row)
    if field_id == "gambling_total_won":
        return sum(
            int(numeric_value(row.get(name)) or 0)
            for name in [
                "gambling_blackjack_won",
                "gambling_slots_won",
                "gambling_poker_won",
                "gambling_wheel_won",
            ]
        )
    value = row.get(field_id)
    numeric = numeric_value(value)
    return int(numeric) if numeric is not None and float(numeric).is_integer() else (numeric if numeric is not None else value)


def survivors_build_rows(payload, category, page_number=1, per_page=15):
    rows = payload.get("results", []) or []
    offset = max(0, (max(1, int(page_number or 1)) - 1) * max(1, int(per_page or 15)))
    category_fields = category["fields"]
    serialized = []
    for index, row in enumerate(rows):
        user = row.get("user") or {}
        values = {
            field["id"]: survivors_category_value(row, field["id"])
            for field in category_fields
        }
        serialized.append({
            "rank": offset + index + 1,
            "playerName": user.get("name") or user.get("steam_id") or row.get("user_id") or "—",
            "steamId": user.get("steam_id"),
            "avatar": survivors_avatar_url(user),
            "values": values,
            "stats": values,
        })
    return serialized


def survivors_select_match(rows, username):
    needle = collapse_whitespace(username)
    if not rows:
        return None
    needle_casefold = needle.casefold()
    for row in rows:
        if collapse_whitespace(row.get("playerName")).casefold() == needle_casefold:
            return row
        if collapse_whitespace(row.get("steamId")).casefold() == needle_casefold:
            return row
    return rows[0]


def fetch_survivors_server_detail(server_id):
    server = find_survivors_server(server_id)
    return {
        "server": {**server, "active": True},
        "periods": survivors_period_options("wipe"),
        "categories": survivors_collect_categories(),
    }


def fetch_survivors_leaderboard(server_id, category_id, period_value="wipe", search="", page_number=1):
    server = find_survivors_server(server_id)
    category = survivors_resolve_category(category_id)
    period = normalize_survivors_mode(period_value)
    query = collapse_whitespace(search)
    page_number = max(1, int(page_number or 1))

    def builder():
        with survivors_page_session() as page:
            survivors_open_catalog(page)
            server_payload, stats_payload = survivors_open_server(page, server, period)
            if query:
                stats_payload = survivors_search_player(page, query)
            if page_number > 1:
                next_payload = survivors_go_to_page(page, page_number)
                if next_payload:
                    stats_payload = next_payload
            return {
                "server": serialize_survivors_server(server_payload, active=True),
                "category": serialize_survivors_category(category),
                "period": next(item for item in survivors_period_options(period) if item["active"]),
                "fields": [dict(field) for field in category["fields"]],
                "rows": survivors_build_rows(stats_payload, category, page_number=page_number),
                "total": int(stats_payload.get("total") or 0),
                "query": {
                    "serverId": server["id"],
                    "categoryId": category["id"],
                    "period": period,
                    "search": query,
                    "page": page_number,
                },
            }

    cache_key = f"survivors:leaderboard:{server['id']}:{category['id']}:{period}:{slugify_label(query or 'all')}:{page_number}"
    return cached_compute(cache_key, SURVIVORS_CACHE_TTL, builder)


def fetch_survivors_player_summary(server_id, username, period_value="wipe"):
    server = find_survivors_server(server_id)
    query = collapse_whitespace(username)
    if not query:
        raise ValueError("请提供玩家名称")
    period = normalize_survivors_mode(period_value)

    def builder():
        with survivors_page_session() as page:
            survivors_open_catalog(page)
            server_payload, stats_payload = survivors_open_server(page, server, period)
            stats_payload = survivors_search_player(page, query)

            identity = None
            categories = []

            for category in SURVIVORS_CATEGORY_SPECS:
                rows = survivors_build_rows(stats_payload, category, page_number=1)
                selected_match = survivors_select_match(rows, query)
                categories.append({
                    "category": serialize_survivors_category(category),
                    "fields": [dict(field) for field in category["fields"]],
                    "matchCount": len(rows),
                    "exactMatchCount": 1 if selected_match and collapse_whitespace(selected_match.get("playerName")).casefold() == query.casefold() else 0,
                    "selectedMatch": selected_match,
                    "matches": rows[:5],
                })
                if selected_match and not identity:
                    identity = {
                        "playerName": selected_match.get("playerName"),
                        "avatar": selected_match.get("avatar"),
                        "steamId": selected_match.get("steamId"),
                    }

            return {
                "server": serialize_survivors_server(server_payload, active=True),
                "period": next(item for item in survivors_period_options(period) if item["active"]),
                "identity": identity,
                "categories": categories,
                "matchedCategories": sum(1 for item in categories if item.get("selectedMatch")),
            }

    cache_key = f"survivors:player:{server['id']}:{period}:{slugify_label(query)}"
    return cached_compute(cache_key, SURVIVORS_CACHE_TTL, builder)


@contextmanager
def atlas_page_session():
    ensure_playwright_available()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            viewport={"width": 1600, "height": 2400},
            locale="en-US",
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36",
        )
        page = context.new_page()
        page.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )
        try:
            page.goto(ATLAS_PLAYER_LOOKUP_URL, wait_until="domcontentloaded", timeout=60000)
            yield page
        finally:
            context.close()
            browser.close()


def validate_atlas_steam_id(steam_id):
    normalized = collapse_whitespace(steam_id)
    if not re.fullmatch(r"\d{17}", normalized or ""):
        raise ValueError("请提供 17 位 Steam64 ID")
    return normalized


def fetch_atlas_meta():
    def builder():
        return {
            "source": ATLAS_PLAYER_LOOKUP_URL,
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

    return cached_compute("atlas:meta", ATLAS_META_TTL, builder)


def atlas_collect_response_info(page):
    response_info = {"status": None, "url": None}

    def handle_response(response):
        if response.url.startswith(f"{ATLAS_API_PUBLIC_BASE}/player/"):
            response_info["status"] = response.status
            response_info["url"] = response.url

    page.on("response", handle_response)
    return response_info


def extract_atlas_error(page):
    for message in [
        "Invalid Steam64 ID Provided",
        "Player not found or error fetching data",
        "Error: An unexpected error occurred.",
        "Access Denied.",
    ]:
        locator = page.get_by_text(message, exact=False)
        if locator.count():
            text = collapse_whitespace(locator.first.inner_text())
            if text:
                return text
    body_text = collapse_whitespace(page.locator("body").inner_text())
    for message in [
        "Invalid Steam64 ID Provided",
        "Player not found or error fetching data",
        "Access Denied.",
    ]:
        if message in body_text:
            return message
    if "An unexpected error occurred." in body_text:
        return "Error: An unexpected error occurred."
    return ""


def extract_atlas_profile(page):
    script = """
() => {
  const textOf = (selector) => {
    const node = document.querySelector(selector);
    return node ? node.textContent.trim() : "";
  };
  const attrOf = (selector, attr) => {
    const node = document.querySelector(selector);
    return node ? (node.getAttribute(attr) || "") : "";
  };
  const parseMetricValue = (valueText) => {
    if (!valueText) return null;
    const normalized = valueText.trim();
    if (!normalized) return null;
    if (normalized.endsWith("%")) {
      const numeric = Number(normalized.replace(/[^0-9.\\-]/g, ""));
      return Number.isFinite(numeric) ? numeric : normalized;
    }
    const compact = normalized.toLowerCase();
    const compactMatch = compact.match(/^([0-9]+(?:\\.[0-9]+)?)([km])(?:\\s+hours)?$/);
    if (compactMatch) {
      const base = Number(compactMatch[1]);
      const factor = compactMatch[2] === "m" ? 1000000 : 1000;
      return Number.isFinite(base) ? Math.round(base * factor) : normalized;
    }
    if (/^\\d+d\\s+\\d+h(?:\\s+\\d+m)?$/.test(normalized) || /^\\d+h(?:\\s+\\d+m)?$/.test(normalized)) {
      return normalized;
    }
    const numeric = Number(normalized.replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : normalized;
  };
  const metrics = Array.from(document.querySelectorAll(".metric-item")).map((node) => {
    const label = node.querySelector(".metric-label")?.textContent?.trim() || "";
    const valueText = node.querySelector(".metric-value")?.textContent?.trim() || "";
    const sub = node.querySelector(".metric-sub")?.textContent?.trim() || "";
    return {
      label,
      value: parseMetricValue(valueText),
      valueText,
      sub,
    };
  });
  const profileLinks = Array.from(document.querySelectorAll(".profile-link")).map((node) => ({
    href: node.getAttribute("href") || "",
    text: node.textContent.trim(),
  }));
  const bans = Array.from(document.querySelectorAll(".ban-list-item")).map((node) => ({
    reason: node.querySelector(".ban-reason")?.textContent?.trim() || "",
    summary: node.textContent.trim(),
  }));
  const clans = Array.from(document.querySelectorAll(".clan-list-item")).map((node) => ({
    name: node.querySelector(".clan-name")?.textContent?.trim() || "",
    details: node.querySelector(".clan-details")?.textContent?.trim() || "",
    meta: node.querySelector(".clan-meta-row")?.textContent?.trim() || "",
  }));
  return {
    name: textOf(".profile-name"),
    avatar: attrOf(".profile-avatar img", "src"),
    countryCode: attrOf(".country-flag", "alt"),
    steamProfileUrl: attrOf(".profile-link[href^='https://steamcommunity.com/profiles/']", "href"),
    battlemetricsUrl: attrOf(".profile-link[href*='battlemetrics.com/players/']", "href"),
    statusChips: Array.from(document.querySelectorAll(".status-chip")).map((node) => node.textContent.trim()).filter(Boolean),
    metaItems: Array.from(document.querySelectorAll(".profile-meta .meta-item")).map((node) => node.textContent.trim()).filter(Boolean),
    metrics,
    bans,
    clans,
  };
}
"""
    return page.evaluate(script)


def atlas_lookup_error_message(response_status, visible_error):
    if visible_error:
        return visible_error
    if response_status == 405:
        return "Access Denied."
    if response_status == 404:
        return "Player not found or error fetching data"
    return "Atlas 页面未返回可用数据"


def normalize_atlas_profile(steam_id, raw_profile, response_status=None, visible_error=""):
    name = raw_profile.get("name") or ""
    battlemetrics_url = raw_profile.get("battlemetricsUrl") or ""
    bm_match = re.search(r"/players/(\d+)", battlemetrics_url)
    steam_profile_url = raw_profile.get("steamProfileUrl") or ""
    metrics = raw_profile.get("metrics") or []
    metric_lookup = {
        collapse_whitespace(item.get("label")).casefold(): item
        for item in metrics
        if item.get("label")
    }
    kd_metric = metric_lookup.get("k/d ratio")
    atlas_metric = metric_lookup.get("atlas playtime")
    bm_metric = metric_lookup.get("battlemetrics")
    accuracy_metric = metric_lookup.get("accuracy")
    has_profile = bool(name and steam_profile_url)
    return {
        "steamId": steam_id,
        "query": {"steamId": steam_id},
        "source": ATLAS_PLAYER_LOOKUP_URL,
        "statusCode": response_status,
        "found": has_profile,
        "error": "" if has_profile else atlas_lookup_error_message(response_status, visible_error),
        "identity": {
            "steamId": steam_id,
            "playerName": name or None,
            "avatar": raw_profile.get("avatar") or None,
            "countryCode": raw_profile.get("countryCode") or None,
            "steamProfileUrl": steam_profile_url or None,
            "battlemetricsUrl": battlemetrics_url or None,
            "battlemetricsPlayerId": bm_match.group(1) if bm_match else None,
            "statusChips": raw_profile.get("statusChips") or [],
            "metaItems": raw_profile.get("metaItems") or [],
        },
        "highlights": {
            "battlemetricsHours": bm_metric.get("value") if bm_metric else None,
            "battlemetricsText": bm_metric.get("valueText") if bm_metric else "",
            "atlasHours": atlas_metric.get("value") if atlas_metric else None,
            "atlasText": atlas_metric.get("valueText") if atlas_metric else "",
            "kdRatio": kd_metric.get("value") if kd_metric else None,
            "kdText": kd_metric.get("valueText") if kd_metric else "",
            "accuracy": accuracy_metric.get("value") if accuracy_metric else None,
            "accuracyText": accuracy_metric.get("valueText") if accuracy_metric else "",
            "accuracySubtext": accuracy_metric.get("sub") if accuracy_metric else "",
        },
        "metrics": metrics,
        "bans": raw_profile.get("bans") or [],
        "banCount": len(raw_profile.get("bans") or []),
        "clans": raw_profile.get("clans") or [],
    }


def fetch_atlas_player_summary(steam_id):
    normalized_steam_id = validate_atlas_steam_id(steam_id)

    def builder():
        with atlas_page_session() as page:
            response_info = atlas_collect_response_info(page)
            search_input = page.locator("input").first
            search_input.wait_for(timeout=30000)
            search_input.fill(normalized_steam_id)
            page.get_by_role("button", name="Search").click()
            deadline = time.time() + 8
            while time.time() < deadline:
                if response_info.get("status") is not None:
                    break
                visible_error = extract_atlas_error(page)
                if visible_error:
                    break
                profile = extract_atlas_profile(page)
                if profile.get("name") or profile.get("metrics") or profile.get("bans") or profile.get("clans"):
                    break
                page.wait_for_timeout(ATLAS_INTERACTION_DELAY_MS)

            visible_error = extract_atlas_error(page)
            profile = extract_atlas_profile(page)
            return normalize_atlas_profile(
                normalized_steam_id,
                profile,
                response_status=response_info.get("status"),
                visible_error=visible_error,
            )

    cache_key = f"atlas:player:{normalized_steam_id}"
    return cached_compute(cache_key, ATLAS_CACHE_TTL, builder)


def rusticated_get(path, params=None, ttl=RUSTICATED_CACHE_TTL):
    payload = cached_get(f"{RUSTICATED_API_BASE}{path}", params={**(params or {}), "orgId": RUSTICATED_ORG_ID}, ttl=ttl)
    if isinstance(payload, dict) and payload.get("success") is False:
        raise RuntimeError(payload.get("error") or "Rusticated API 返回失败")
    return payload.get("data") if isinstance(payload, dict) and "data" in payload else payload


def fetch_rusticated_servers():
    servers = rusticated_get("/v2/servers", ttl=RUSTICATED_META_TTL) or []
    return sorted(servers, key=lambda item: (item.get("spot") or 9999, str(item.get("name", "")).casefold()))


def fetch_rusticated_stat_groups():
    groups = rusticated_get("/v3/leaderboard/stat-groups", params={}, ttl=RUSTICATED_META_TTL) or []
    return sorted(groups, key=lambda item: (item.get("sortOrder") if item.get("sortOrder") is not None else 9999, str(item.get("name", "")).casefold()))


def fetch_rusticated_wipes():
    wipes = rusticated_get("/v3/server-wipes", params={}, ttl=RUSTICATED_META_TTL) or []
    return sorted(
        wipes,
        key=lambda item: (
            str(item.get("serverId", "")).casefold(),
            item.get("startedAt") or "",
        ),
        reverse=True,
    )


def rusticated_field_kind(field_id):
    if field_id == "playtime":
        return "duration"
    if field_id == "kdr":
        return "ratio"
    return "number"


def serialize_rusticated_field(stat_type):
    return {
        "id": stat_type.get("id"),
        "name": collapse_whitespace(stat_type.get("name")),
        "group": stat_type.get("group"),
        "sortOrder": stat_type.get("sortOrder"),
        "kind": rusticated_field_kind(stat_type.get("id")),
    }


def serialize_rusticated_group(group):
    stat_types = sorted(
        group.get("statTypes", []) or [],
        key=lambda item: (
            item.get("sortOrder") if item.get("sortOrder") is not None else 9999,
            str(item.get("name", "")).casefold(),
        ),
    )
    return {
        "id": group.get("id"),
        "name": group.get("name"),
        "sortOrder": group.get("sortOrder"),
        "fields": [serialize_rusticated_field(item) for item in stat_types],
        "defaultSort": stat_types[0].get("id") if stat_types else "",
    }


def serialize_rusticated_server(server):
    population = server.get("population") or {}
    last_events = server.get("lastEvents") or {}
    map_info = server.get("map") or {}
    return {
        "id": server.get("id"),
        "name": server.get("name"),
        "title": server.get("title"),
        "host": server.get("host"),
        "port": server.get("port"),
        "online": bool(server.get("online")),
        "timezone": server.get("timezone"),
        "maxTeamSize": server.get("maxTeamSize"),
        "nextWipe": server.get("nextWipe"),
        "nextForcedWipe": server.get("nextForcedWipe"),
        "currentWipeStartedAt": last_events.get("wipe"),
        "population": {
            "players": population.get("players", 0),
            "maxPlayers": population.get("maxPlayers", 0),
            "queued": population.get("queued", 0),
            "joining": population.get("joining", 0),
        },
        "map": {
            "name": map_info.get("name"),
            "worldSize": map_info.get("worldSize"),
            "seed": map_info.get("seed"),
        },
    }


def serialize_rusticated_wipe(wipe):
    return {
        "id": wipe.get("id"),
        "serverId": wipe.get("serverId"),
        "startedAt": wipe.get("startedAt"),
        "endedAt": wipe.get("endedAt"),
        "mapId": wipe.get("mapId"),
        "mapSize": wipe.get("mapSize"),
        "mapImageUrl": wipe.get("mapImageUrl"),
        "mapRustMapsId": wipe.get("mapRustMapsId"),
        "mapRustMapsUrl": wipe.get("mapRustMapsUrl"),
    }


def find_rusticated_server(server_id):
    lookup = collapse_whitespace(server_id).casefold()
    for server in fetch_rusticated_servers():
        if str(server.get("id", "")).casefold() == lookup or str(server.get("name", "")).casefold() == lookup:
            return server
    raise KeyError("找不到该 Rusticated 服务器")


def find_rusticated_group(group_id):
    lookup = collapse_whitespace(group_id).casefold()
    for group in fetch_rusticated_stat_groups():
        if str(group.get("id", "")).casefold() == lookup or str(group.get("name", "")).casefold() == lookup:
            return group
    raise KeyError("找不到该 Rusticated 统计类型")


def list_rusticated_server_wipes(server_id):
    if not server_id:
        return []
    server = find_rusticated_server(server_id)
    return [
        wipe
        for wipe in fetch_rusticated_wipes()
        if str(wipe.get("serverId", "")).casefold() == str(server.get("id", "")).casefold()
    ]


def resolve_rusticated_wipe(server_id, wipe_id=None):
    wipes = list_rusticated_server_wipes(server_id)
    if not wipes:
        return None
    if wipe_id in {None, "", 0, "0"}:
        return wipes[0]
    for wipe in wipes:
        if str(wipe.get("id")) == str(wipe_id):
            return wipe
    raise KeyError("找不到该 Rusticated wipe")


def fetch_rusticated_server_detail(server_id):
    server = find_rusticated_server(server_id)
    wipes = list_rusticated_server_wipes(server_id)
    groups = [serialize_rusticated_group(group) for group in fetch_rusticated_stat_groups()]
    return {
        "server": serialize_rusticated_server(server),
        "wipes": [serialize_rusticated_wipe(wipe) for wipe in wipes],
        "defaultWipeId": wipes[0].get("id") if wipes else None,
        "groups": groups,
    }


def fetch_rusticated_leaderboard(server_id="", wipe_id=None, group_id="pvp", sort_by="", sort_dir="desc", entry_type="player", filter_value="", offset=0, limit=10, hidden=False, event_type=""):
    group = find_rusticated_group(group_id)
    stat_types = group.get("statTypes", []) or []
    default_sort = stat_types[0].get("id") if stat_types else ""
    server = find_rusticated_server(server_id) if server_id else None
    wipe = resolve_rusticated_wipe(server_id, wipe_id) if server_id else None
    normalized_sort = sort_by or default_sort
    params = {
        "hidden": "true" if hidden else "false",
        "limit": max(1, int(limit)),
        "offset": max(0, int(offset)),
        "group": group.get("id"),
        "sortBy": normalized_sort,
        "sortDir": "asc" if str(sort_dir).lower() == "asc" else "desc",
        "type": entry_type or "player",
        "eventType": event_type or normalized_sort or default_sort,
        "filter": filter_value or "",
    }
    if server:
        params["serverId"] = server.get("id")
    if wipe:
        params["serverWipeId"] = wipe.get("id")

    payload = rusticated_get("/v3/leaderboard", params=params, ttl=RUSTICATED_CACHE_TTL) or {}
    serialized_group = serialize_rusticated_group(group)
    return {
        "server": serialize_rusticated_server(server) if server else None,
        "wipe": serialize_rusticated_wipe(wipe) if wipe else None,
        "group": serialized_group,
        "fields": serialized_group["fields"],
        "rows": payload.get("entries", []) or [],
        "total": payload.get("total", 0),
        "userEntry": payload.get("userEntry"),
        "query": {
            "serverId": server.get("id") if server else "",
            "serverWipeId": wipe.get("id") if wipe else 0,
            "groupId": group.get("id"),
            "sortBy": normalized_sort,
            "sortDir": params["sortDir"],
            "type": params["type"],
            "eventType": params["eventType"],
            "filter": params["filter"],
            "offset": params["offset"],
            "limit": params["limit"],
        },
    }


def fetch_rusticated_player_summary(server_id, username, wipe_id=None):
    server = find_rusticated_server(server_id)
    wipe = resolve_rusticated_wipe(server_id, wipe_id)
    groups = [serialize_rusticated_group(group) for group in fetch_rusticated_stat_groups()]
    normalized_username = collapse_whitespace(username)
    if not normalized_username:
        raise ValueError("请提供玩家名称")

    results = []
    identity = None
    username_cf = normalized_username.casefold()

    for group in groups:
        payload = fetch_rusticated_leaderboard(
            server_id=server.get("id"),
            wipe_id=wipe.get("id") if wipe else None,
            group_id=group["id"],
            sort_by=group["defaultSort"],
            sort_dir="desc",
            entry_type="player",
            filter_value=normalized_username,
            offset=0,
            limit=10,
        )
        rows = payload.get("rows", [])
        exact_matches = [row for row in rows if str(row.get("username", "")).casefold() == username_cf]
        selected_match = max(exact_matches, key=rusticated_match_score) if exact_matches else (rows[0] if rows else None)
        results.append({
            "group": group,
            "fields": group["fields"],
            "matchCount": len(rows),
            "exactMatchCount": len(exact_matches),
            "selectedMatch": selected_match,
            "matches": rows[:5],
        })
        if selected_match and not identity:
            identity = {
                "steamId": selected_match.get("steamId"),
                "username": selected_match.get("username"),
                "avatarUrl": selected_match.get("avatarUrl"),
            }

    return {
        "server": serialize_rusticated_server(server),
        "wipe": serialize_rusticated_wipe(wipe) if wipe else None,
        "identity": identity,
        "groups": results,
        "matchedGroups": sum(1 for item in results if item.get("selectedMatch")),
    }


def rusticated_match_score(row):
    stats = row.get("stats") or {}
    score = 0.0
    for value in stats.values():
        numeric = numeric_value(value)
        if numeric is not None:
            score += max(0.0, numeric)
    return score


# ══════════════════════════════════════════════════════════
#  路由
# ══════════════════════════════════════════════════════════

@app.route("/api/auth/status")
def api_auth_status():
    return jsonify({"authenticated": True})


@app.route("/api/auth/login", methods=["POST"])
def api_auth_login():
    return jsonify({"ok": True, "authenticated": True})


@app.route("/api/auth/logout", methods=["POST"])
def api_auth_logout():
    return jsonify({"ok": True, "authenticated": True})

@app.route("/api/player/<path:input_id>")
def api_player(input_id):
    try:
        sid = resolve_steam_id(input_id)
        if not sid:
            return jsonify({"error": "无法解析 Steam ID"}), 404
        info = get_player_summary(sid)
        if not info:
            return jsonify({"error": "找不到该玩家"}), 404
        return jsonify(info)
    except ConfigurationError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/kda/<path:input_id>")
def api_kda(input_id):
    try:
        sid = resolve_steam_id(input_id)
        if not sid:
            return jsonify({"error": "无效的 Steam ID"}), 400
        return jsonify(get_player_kda(sid))
    except ConfigurationError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/inventory/<path:input_id>")
def api_inventory(input_id):
    """
    综合库存查询 — 同时返回可交易皮肤 + DLC 扩展包
    
    响应结构:
    {
      "skins": [...],         // 可交易库存皮肤
      "dlcs": [...],          // DLC 列表 (含 owned 字段)
      "skinsSummary": {...},
      "dlcSummary": {...},
      "totalSummary": {...}
    }
    """
    try:
        sid = resolve_steam_id(input_id)
        if not sid:
            return jsonify({"error": "无效的 Steam ID"}), 400
        return jsonify(get_player_inventory_with_dlc(sid))
    except ConfigurationError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/dlcs")
def api_dlc_list():
    """获取所有 Rust DLC 列表及详情"""
    try:
        dlc_ids = fetch_rust_dlc_list()
        dlcs = []
        for did in dlc_ids:
            d = fetch_dlc_details(did)
            known = RUST_DLCS.get(did, {})
            d["nameCN"] = known.get("nameCN", d.get("name", ""))
            d["category"] = known.get("category", "DLC")
            dlcs.append(d)
            time.sleep(0.3)
        return jsonify({"dlcs": dlcs, "count": len(dlcs)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/servers/search")
def api_server_search():
    q = request.args.get("q", "")
    if not q:
        return jsonify({"error": "请提供搜索关键词"}), 400
    try:
        return jsonify({"players": search_bm_player(q)})
    except ConfigurationError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/servers/candidates/<path:player_ref>")
def api_server_candidates(player_ref):
    try:
        return jsonify(find_bm_candidates_for_player_ref(player_ref))
    except ConfigurationError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/servers/<path:player_ref>")
def api_servers(player_ref):
    try:
        explicit_bm_id = request.args.get("bmId", "").strip()
        bm_id = explicit_bm_id or resolve_bm_player_id(player_ref)
        if not bm_id:
            return jsonify({"error": "找不到对应的 BattleMetrics 玩家"}), 404
        result = get_player_servers(bm_id)
        result["bmId"] = bm_id
        result["selectionMode"] = "explicit" if explicit_bm_id else "auto"
        return jsonify(result)
    except ConfigurationError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/atlas/meta")
def api_atlas_meta():
    try:
        return jsonify(fetch_atlas_meta())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/atlas/player-search")
def api_atlas_player_search():
    steam_id = request.args.get("steamId", "").strip()
    if not steam_id:
        return jsonify({"error": "请提供 Steam64 ID"}), 400
    try:
        payload = fetch_atlas_player_summary(steam_id)
        if not payload.get("found"):
            status_code = payload.get("statusCode")
            if status_code == 405:
                return jsonify(payload), 502
            return jsonify(payload), 404
        return jsonify(payload)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except PlaywrightTimeoutError:
        return jsonify({"error": "Atlas 页面加载超时"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/survivors/servers")
def api_survivors_servers():
    try:
        catalog = fetch_survivors_catalog()
        return jsonify({
            "source": catalog["source"],
            "servers": catalog["servers"],
            "categories": catalog["categories"],
            "count": len(catalog["servers"]),
        })
    except PlaywrightTimeoutError:
        return jsonify({"error": "Survivors 页面加载超时"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/survivors/servers/<server_id>")
def api_survivors_server_detail(server_id):
    try:
        return jsonify(fetch_survivors_server_detail(server_id))
    except KeyError as e:
        return jsonify({"error": str(e)}), 404
    except PlaywrightTimeoutError:
        return jsonify({"error": "Survivors 页面加载超时"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/survivors/servers/<server_id>/leaderboards/<category_id>")
def api_survivors_leaderboard(server_id, category_id):
    period = request.args.get("period", "").strip()
    search = request.args.get("search", "").strip()
    page_value = request.args.get("page", "1").strip() or "1"
    try:
        return jsonify(
            fetch_survivors_leaderboard(
                server_id=server_id,
                category_id=category_id,
                period_value=period,
                search=search,
                page_number=int(page_value),
            )
        )
    except KeyError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError:
        return jsonify({"error": "page 参数必须是整数"}), 400
    except PlaywrightTimeoutError:
        return jsonify({"error": "Survivors 页面加载超时"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/survivors/player-search")
def api_survivors_player_search():
    server_id = request.args.get("serverId", "").strip()
    username = request.args.get("username", "").strip()
    period = request.args.get("period", "").strip()
    if not server_id:
        return jsonify({"error": "请提供 serverId"}), 400
    if not username:
        return jsonify({"error": "请提供玩家名称"}), 400
    try:
        return jsonify(fetch_survivors_player_summary(server_id, username, period))
    except KeyError as e:
        return jsonify({"error": str(e)}), 404
    except PlaywrightTimeoutError:
        return jsonify({"error": "Survivors 页面加载超时"}), 504
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/moose/servers")
def api_moose_servers():
    try:
        catalog = fetch_moose_catalog()
        return jsonify({
            "source": catalog["source"],
            "servers": catalog["servers"],
            "categories": catalog["categories"],
            "count": len(catalog["servers"]),
        })
    except PlaywrightTimeoutError:
        return jsonify({"error": "Moose 页面加载超时"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/moose/servers/<server_id>")
def api_moose_server_detail(server_id):
    try:
        return jsonify(fetch_moose_server_detail(server_id))
    except KeyError as e:
        return jsonify({"error": str(e)}), 404
    except PlaywrightTimeoutError:
        return jsonify({"error": "Moose 页面加载超时"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/moose/servers/<server_id>/leaderboards/<category_id>")
def api_moose_leaderboard(server_id, category_id):
    period = request.args.get("period", "").strip()
    search = request.args.get("search", "").strip()
    page_value = request.args.get("page", "1").strip() or "1"
    try:
        payload = fetch_moose_leaderboard(
            server_id=server_id,
            category_id=category_id,
            period_value=period,
            search=search,
            page_number=int(page_value),
        )
        return jsonify(payload)
    except KeyError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError:
        return jsonify({"error": "page 参数必须是整数"}), 400
    except PlaywrightTimeoutError:
        return jsonify({"error": "Moose 页面加载超时"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/moose/player-search")
def api_moose_player_search():
    server_id = request.args.get("serverId", "").strip()
    username = request.args.get("username", "").strip()
    period = request.args.get("period", "").strip()
    if not server_id:
        return jsonify({"error": "请提供 serverId"}), 400
    if not username:
        return jsonify({"error": "请提供玩家名称"}), 400
    try:
        return jsonify(fetch_moose_player_summary(server_id, username, period))
    except KeyError as e:
        return jsonify({"error": str(e)}), 404
    except PlaywrightTimeoutError:
        return jsonify({"error": "Moose 页面加载超时"}), 504
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rusticated/servers")
def api_rusticated_servers():
    try:
        servers = [serialize_rusticated_server(server) for server in fetch_rusticated_servers()]
        groups = [serialize_rusticated_group(group) for group in fetch_rusticated_stat_groups()]
        return jsonify({
            "source": "https://rusticated.com/leaderboards",
            "servers": servers,
            "groups": groups,
            "count": len(servers),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rusticated/servers/<server_id>")
def api_rusticated_server_detail(server_id):
    try:
        return jsonify(fetch_rusticated_server_detail(server_id))
    except KeyError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rusticated/servers/<server_id>/leaderboards/<group_id>")
def api_rusticated_leaderboard(server_id, group_id):
    wipe_id = request.args.get("wipeId", "").strip()
    sort_by = request.args.get("sortBy", "").strip()
    sort_dir = request.args.get("sortDir", "desc").strip()
    entry_type = request.args.get("type", "player").strip()
    filter_value = request.args.get("filter", "").strip()
    offset = request.args.get("offset", "0").strip() or "0"
    limit = request.args.get("limit", "10").strip() or "10"
    event_type = request.args.get("eventType", "").strip()
    try:
        return jsonify(
            fetch_rusticated_leaderboard(
                server_id=server_id,
                wipe_id=wipe_id,
                group_id=group_id,
                sort_by=sort_by,
                sort_dir=sort_dir,
                entry_type=entry_type,
                filter_value=filter_value,
                offset=int(offset),
                limit=int(limit),
                event_type=event_type,
            )
        )
    except KeyError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError:
        return jsonify({"error": "offset 和 limit 必须是整数"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rusticated/player-search")
def api_rusticated_player_search():
    server_id = request.args.get("serverId", "").strip()
    username = request.args.get("username", "").strip()
    wipe_id = request.args.get("wipeId", "").strip()
    if not server_id:
        return jsonify({"error": "请提供 serverId"}), 400
    if not username:
        return jsonify({"error": "请提供玩家名称"}), 400
    try:
        return jsonify(fetch_rusticated_player_summary(server_id, username, wipe_id))
    except KeyError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rustoria/servers")
def api_rustoria_servers():
    try:
        leaderboard_only = request.args.get("leaderboardOnly", "1").strip().lower() not in {"0", "false", "no"}
        servers = fetch_rustoria_servers()
        if leaderboard_only:
            servers = [server for server in servers if server.get("leaderboardServer")]
        return jsonify({
            "servers": [serialize_rustoria_server(server) for server in servers],
            "count": len(servers),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rustoria/servers/<server_id>")
def api_rustoria_server_detail(server_id):
    try:
        server = fetch_rustoria_server_detail(server_id)
        mappings = fetch_rustoria_statistic_mappings()
        return jsonify({
            "server": {
                **serialize_rustoria_server(server),
                "statistics": [
                    serialize_rustoria_statistic(statistic, mappings)
                    for statistic in sorted(server.get("statistics", []), key=lambda item: item.get("order") or 999)
                ],
            }
        })
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            return jsonify({"error": "找不到该 Rustoria 服务器"}), 404
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rustoria/servers/<server_id>/wipes")
def api_rustoria_wipes(server_id):
    try:
        return jsonify({
            "serverId": server_id,
            "wipes": fetch_rustoria_wipes(server_id),
        })
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            return jsonify({"error": "找不到该 Rustoria 服务器"}), 404
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rustoria/servers/<server_id>/leaderboards/<statistic_id>")
def api_rustoria_leaderboard(server_id, statistic_id):
    try:
        server_detail = fetch_rustoria_server_detail(server_id)
        mappings = fetch_rustoria_statistic_mappings()
        statistic = find_rustoria_statistic(server_detail, statistic_id)
        if not statistic:
            return jsonify({"error": "该服务器不支持此统计类型"}), 404

        from_value = request.args.get("from", "0").strip() or "0"
        sort_by = request.args.get("sortBy", "").strip() or statistic.get("default_sort") or "total"
        order_by = request.args.get("orderBy", "desc").strip().lower()
        username = request.args.get("username", "").strip()
        wipe = request.args.get("wipe", "").strip()

        leaderboard = fetch_rustoria_leaderboard(
            server_id=server_id,
            statistic_id=statistic_id,
            from_value=int(from_value),
            sort_by=sort_by,
            order_by=order_by,
            username=username,
            wipe=wipe,
        )
        totals = fetch_rustoria_leaderboard_totals(server_id, statistic_id, wipe)
        rows = leaderboard.get("leaderboard", []) or []
        field_ids = build_rustoria_field_ids(statistic, totals=totals, leaderboard_rows=rows)
        statistic_payload = serialize_rustoria_statistic(statistic, mappings, field_ids)

        serialized_rows = []
        offset = max(0, int(from_value))
        for index, row in enumerate(rows):
            serialized_rows.append({
                **row,
                "rank": offset + index + 1,
            })

        return jsonify({
            "server": serialize_rustoria_server(server_detail),
            "statistic": statistic_payload,
            "fields": statistic_payload["fields"],
            "rows": serialized_rows,
            "totals": totals,
            "totalItems": leaderboard.get("totalItems", 0),
            "query": {
                "serverId": server_id,
                "statisticId": statistic_id,
                "from": offset,
                "sortBy": sort_by,
                "orderBy": "asc" if order_by == "asc" else "desc",
                "username": username,
                "wipe": wipe,
            },
        })
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            return jsonify({"error": "找不到该 Rustoria 数据"}), 404
        return jsonify({"error": str(e)}), 502
    except ValueError:
        return jsonify({"error": "from 参数必须是整数"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rustoria/player-search")
def api_rustoria_player_search():
    server_id = request.args.get("serverId", "").strip()
    username = request.args.get("username", "").strip()
    wipe = request.args.get("wipe", "").strip()
    if not server_id:
        return jsonify({"error": "请提供 serverId"}), 400
    if not username:
        return jsonify({"error": "请提供玩家名称"}), 400
    try:
        return jsonify(fetch_rustoria_player_summary(server_id, username, wipe))
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            return jsonify({"error": "找不到该 Rustoria 数据"}), 404
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/health")
def api_health():
    return jsonify({
        "status": "ok",
        "version": "2.0",
        "steamKeySet": steam_api_key_set(),
        "bmTokenSet": battlemetrics_token_set(),
        "knownDlcs": len(RUST_DLCS),
        "cacheSize": len(_cache),
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5050"))
    debug_mode = os.getenv("FLASK_DEBUG", "").strip().lower() in {"1", "true", "yes", "on"}
    print("=" * 58)
    print("  🎮  Rust 玩家查询工具 v2.0 - API 服务器")
    print("  📦  新增: DLC 扩展包检测 (Jungle Pack 等)")
    print("=" * 58)
    print(f"  Steam API Key:       {'✅' if steam_api_key_set() else '❌ 未配置'}")
    print(f"  BattleMetrics Token: {'✅' if battlemetrics_token_set() else '❌ 未配置'}")
    print(f"  已知 DLC 数量:        {len(RUST_DLCS)}")
    print(f"  监听端口:             {port}")
    print(f"  调试模式:             {'✅' if debug_mode else '❌ 关闭'}")
    print()
    print("  端点:")
    print("  GET /api/player/<id>       玩家信息")
    print("  GET /api/kda/<id>          KDA 数据")
    print("  GET /api/inventory/<id>    库存 + DLC")
    print("  GET /api/dlcs              全部 Rust DLC")
    print("  GET /api/servers/search    BM 搜索")
    print("  GET /api/servers/<bm_id>   服务器时长")
    print("=" * 58)
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
