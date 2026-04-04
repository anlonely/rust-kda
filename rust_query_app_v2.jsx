import { startTransition, useCallback, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const normalizeLang = (value) => String(value || "").toLowerCase().startsWith("zh") ? "zh" : "en";
const defaultCurrencyForLang = (lang) => lang === "zh" ? "CNY" : "USD";
const detectInitialLang = () => {
  if (typeof window === "undefined") return "zh";
  const saved = window.localStorage.getItem("rust-kda-language");
  if (saved === "zh" || saved === "en") return saved;
  const browserLang = window.navigator.languages?.[0] || window.navigator.language || "en";
  return normalizeLang(browserLang);
};
const detectInitialCurrency = (lang) => {
  if (typeof window === "undefined") return defaultCurrencyForLang(lang);
  const saved = window.localStorage.getItem("rust-kda-currency");
  if (saved === "USD" || saved === "CNY") return saved;
  return defaultCurrencyForLang(lang);
};
const detectCurrencyManual = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("rust-kda-currency-manual") === "1";
};
const fmt = (n, locale = "en-US") => {
  if (n >= 1e6) return (n / 1e6).toLocaleString(locale, { maximumFractionDigits: 1 }) + "M";
  if (n >= 1e3) return (n / 1e3).toLocaleString(locale, { maximumFractionDigits: 1 }) + "K";
  return (n || 0).toLocaleString(locale);
};
const timeAgo = (s, lang = "zh") => {
  if (!s) return "—";
  const h = (Date.now() - new Date(s).getTime()) / 36e5;
  if (lang === "zh") {
    if (h < 1) return "刚刚";
    if (h < 24) return `${Math.floor(h)}小时前`;
    const d = h / 24;
    return d < 30 ? `${Math.floor(d)}天前` : `${Math.floor(d / 30)}个月前`;
  }
  if (h < 1) return "Just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  return d < 30 ? `${Math.floor(d)}d ago` : `${Math.floor(d / 30)}mo ago`;
};
const fmtMetric = (v, locale = "en-US") => typeof v === "number" ? (Number.isInteger(v) ? fmt(v, locale) : v.toLocaleString(locale, { maximumFractionDigits: 1 })) : (v ?? "—");
const fmtFull = (v, locale = "en-US") => typeof v === "number" ? v.toLocaleString(locale, { maximumFractionDigits: Number.isInteger(v) ? 0 : 1 }) : (v ?? "—");
const fmtHours = (v, locale = "en-US") => v == null ? "—" : `${v.toLocaleString(locale, { maximumFractionDigits: 1 })}h`;
const fmtServerDuration = (v, lang = "zh", locale = "en-US") => {
  if (v == null) return "—";
  if (v > 0 && v < 1) {
    const minutes = Math.max(1, Math.round(v * 60));
    return lang === "zh" ? `${minutes}分钟` : `${minutes} min`;
  }
  return lang === "zh"
    ? `${v.toLocaleString(locale, { maximumFractionDigits: 1 })}小时`
    : `${v.toLocaleString(locale, { maximumFractionDigits: 1 })}h`;
};
const fmtDate = (ts, locale = "zh-CN") => !ts ? "—" : new Date(typeof ts === "number" ? ts * 1000 : ts).toLocaleDateString(locale);
const fmtMoney = (v, locale = "en-US", currency = "USD") => v == null ? "—" : new Intl.NumberFormat(locale, { style: "currency", currency }).format(v);
const fmtPercent = (v, locale = "en-US") => v == null ? "—" : `${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const fmtDateTime = (ts, locale = "zh-CN") => !ts ? "—" : new Date(typeof ts === "number" ? ts * 1000 : ts).toLocaleString(locale, { hour12: false });
const yearsSince = (ts, lang = "zh", locale = "zh-CN") => {
  if (!ts) return "—";
  const now = new Date();
  const then = new Date(typeof ts === "number" ? ts * 1000 : ts);
  const years = (now - then) / (365.25 * 24 * 60 * 60 * 1000);
  return lang === "zh"
    ? `${years.toLocaleString(locale, { maximumFractionDigits: 1 })}年`
    : `${years.toLocaleString(locale, { maximumFractionDigits: 1 })} years`;
};
const convertMoney = (value, currency = "USD", usdToCny = null) => {
  if (value == null) return null;
  if (currency === "CNY" && typeof usdToCny === "number" && usdToCny > 0) {
    return value * usdToCny;
  }
  return value;
};

const RC = {
  legendary:{bg:"#1a0f00",bd:"#ff9800",tx:"#ffcc80",gw:"rgba(255,152,0,.25)"},
  epic:{bg:"#140022",bd:"#ab47bc",tx:"#ce93d8",gw:"rgba(171,71,188,.25)"},
  rare:{bg:"#001428",bd:"#2196f3",tx:"#90caf9",gw:"rgba(33,150,243,.25)"},
  uncommon:{bg:"#081a08",bd:"#66bb6a",tx:"#a5d6a7",gw:"rgba(102,187,106,.2)"},
  common:{bg:"#141414",bd:"#616161",tx:"#bdbdbd",gw:"rgba(97,97,97,.15)"},
  dlc_owned:{bg:"#0d1a0d",bd:"#66bb6a",tx:"#a5d6a7",gw:"rgba(102,187,106,.2)"},
  dlc_notowned:{bg:"#111",bd:"#37474f",tx:"#78909c",gw:"rgba(55,71,79,.15)"},
};
const rarityLabel = {legendary:"传说",epic:"史诗",rare:"稀有",uncommon:"普通",common:"基础"};
const rarityLabelEn = { legendary: "Legendary", epic: "Epic", rare: "Rare", uncommon: "Uncommon", common: "Base" };

const UI = {
  zh: {
    appTitle: "Rust 玩家查询工具",
    appSubtitle: "KDA · INVENTORY · PLAYTIME",
    language: "语言",
    currency: "币种",
    exchangeRate: "汇率",
    usdLabel: "USD",
    rmbLabel: "RMB",
    rateAttribution: "汇率来源",
    queryPlaceholder: "Steam ID64 / 自定义 URL / Vanity 名称...",
    queryButton: "查询",
    querying: "正在查询数据...",
    emptyTitle: "输入 Steam ID 开始查询",
    emptyHint: "支持 SteamID64 / 自定义 URL / Vanity 名称",
    demoNotice: "⚡ 演示模式 — 后端未连接。运行 python rust_query_server_v2.py 启用真实查询",
    kdaTab: "KDA 数据",
    inventoryTab: "库存",
    serversTab: "服务器时长",
    playerCreated: "创建于",
    online: "在线",
    inGame: "游戏中",
    offline: "离线",
    demoStatus: "演示模式",
    rustHours: "Rust 总时长",
    recentTwoWeeks: "最近两周",
    unlockedAchievements: "已解锁成就",
    inventoryValue: "库存估值",
    serverPlaytime: "服务器时长",
    accountAge: "账号年龄",
    recentActive: "最近活跃",
    profileOverview: "Profile 概览",
    profileOverviewValue: "官方 Steam 数据 + Rust Stats 映射",
    compositeScore: "综合评分",
    compositeScoreNote: "基于 KD、爆头率、Rust 时长、服务器时长和库存估值的本地画像分。",
    kdRating: "KD 综合评级",
    accuracyFormula: "准确率 = 玩家子弹命中 ÷ 子弹发射",
    headshotFormula: "爆头率 = 爆头次数 ÷ 玩家子弹命中",
    combatOverview: "战斗总览",
    totalAssetValue: "账号总资产价值",
    tradable: "可交易",
    storeOwnedValue: "官方商城命中价值",
    inventoryUnavailable: "库存估值不可用",
    storeUnavailable: "商城目录不可用",
    inventoryWorth: "库存价值",
    steamWebOnly: "Steam 网页独有",
    scmmPriced: "SCMM 已定价",
    currentStore: "当前官方商城",
    nonTradableValue: "不可交易价值",
    matchedCount: "已匹配",
    currentStoreMatched: "当前商城命中",
    allAssets: "全部资产",
    storeCatalog: "官方商城目录",
    mergedInventory: "合并库存",
    steamOnlyAssets: "Steam 网页独有资产",
    sortByPrice: "按价格",
    sortByName: "按名称",
    accountBound: "账号绑定",
    unpriced: "未定价",
    inventoryItem: "库存物品",
    storeItem: "商城物品",
    hitInInventory: "已在库存命中",
    notHitInInventory: "未在库存命中",
    scmmAvailable: "SCMM 可定价",
    steamWebExclusive: "Steam 网页专属",
    openStore: "打开商城",
    chooseBmUser: "选择 BattleMetrics 用户",
    chooseBmHint: "重名时请手动确认，确认后再加载服务器时长。",
    serversDevNotice: "开发中。暂不可用。",
    reselect: "重新选择",
    noBmCandidatesTitle: "服务器时长需要确认 BattleMetrics 用户",
    noBmCandidatesHint: "当前没有候选可选。你可以重新查询或检查 BattleMetrics Token。",
    candidateScore: "候选分数",
    sessionPreview: "会话预览",
    recentSeen: "最近出现",
    noRecentSeen: "无最近记录",
    selectedNow: "当前已选择",
    selectOneFirst: "先从上面选择一个用户",
    loadingSelectedServer: "正在加载所选 BattleMetrics 用户的服务器时长...",
    loadSelectedServer: "加载所选用户服务器时长",
    totalPlaytime: "总游玩时长",
    approxDays: "≈ {value} 天",
    totalSessions: "共 {value} 次会话",
    servers: "服务器",
    sessions: "次会话",
    onlinePlayers: "在线 {value}",
    offlineShort: "离线",
    timesShort: "次",
    noBmFound: "没有找到可确认的 BattleMetrics 用户",
    bmSearchFailed: "BattleMetrics 候选搜索失败",
    serverLoadFailed: "服务器时长加载失败",
    requestFailed: "请求失败",
    loading: "加载中",
    english: "English",
    chinese: "中文",
  },
  en: {
    appTitle: "Rust Player Query",
    appSubtitle: "KDA · INVENTORY · PLAYTIME",
    language: "Language",
    currency: "Currency",
    exchangeRate: "FX Rate",
    usdLabel: "USD",
    rmbLabel: "RMB",
    rateAttribution: "Rates by",
    queryPlaceholder: "Steam ID64 / Custom URL / Vanity name...",
    queryButton: "Search",
    querying: "Loading player data...",
    emptyTitle: "Enter a Steam ID to begin",
    emptyHint: "Supports SteamID64 / Custom URL / Vanity name",
    demoNotice: "⚡ Demo mode — backend unavailable. Run python rust_query_server_v2.py to enable live queries.",
    kdaTab: "KDA",
    inventoryTab: "Inventory",
    serversTab: "Server Time",
    playerCreated: "Created",
    online: "Online",
    inGame: "In Game",
    offline: "Offline",
    demoStatus: "Demo",
    rustHours: "Rust Hours",
    recentTwoWeeks: "Last 2 Weeks",
    unlockedAchievements: "Achievements",
    inventoryValue: "Inventory Value",
    serverPlaytime: "Server Time",
    accountAge: "Account Age",
    recentActive: "Last Active",
    profileOverview: "Profile Overview",
    profileOverviewValue: "Steam profile data + Rust stats mapping",
    compositeScore: "Composite Score",
    compositeScoreNote: "Local profile score based on KD, headshot rate, Rust hours, server time, and inventory value.",
    kdRating: "KD Rating",
    accuracyFormula: "Accuracy = Player bullet hits ÷ bullets fired",
    headshotFormula: "Headshot Rate = headshots ÷ player bullet hits",
    combatOverview: "Combat Overview",
    totalAssetValue: "Account Asset Value",
    tradable: "Tradable",
    storeOwnedValue: "Official Store Match Value",
    inventoryUnavailable: "Inventory valuation unavailable",
    storeUnavailable: "Store catalog unavailable",
    inventoryWorth: "Inventory Value",
    steamWebOnly: "Steam Web Only",
    scmmPriced: "SCMM Priced",
    currentStore: "Official Store",
    nonTradableValue: "Non-tradable Value",
    matchedCount: "Matched",
    currentStoreMatched: "Current store matches",
    allAssets: "All Assets",
    storeCatalog: "Official Store Catalog",
    mergedInventory: "Merged Inventory",
    steamOnlyAssets: "Steam Web-only Assets",
    sortByPrice: "Sort by Price",
    sortByName: "Sort by Name",
    accountBound: "Account Bound",
    unpriced: "Unpriced",
    inventoryItem: "Inventory Item",
    storeItem: "Store Item",
    hitInInventory: "Matched in inventory",
    notHitInInventory: "Not matched in inventory",
    scmmAvailable: "SCMM priceable",
    steamWebExclusive: "Steam web only",
    openStore: "Open Store",
    chooseBmUser: "Choose a BattleMetrics User",
    chooseBmHint: "When names collide, pick the correct profile first, then load server playtime.",
    serversDevNotice: "In development. Temporarily unavailable.",
    reselect: "Choose Again",
    noBmCandidatesTitle: "Server playtime needs a BattleMetrics identity",
    noBmCandidatesHint: "No candidates are available right now. Re-run the query or check the BattleMetrics token.",
    candidateScore: "Candidate Score",
    sessionPreview: "Session Preview",
    recentSeen: "Recently Seen",
    noRecentSeen: "No recent record",
    selectedNow: "Selected",
    selectOneFirst: "Select one candidate above first",
    loadingSelectedServer: "Loading server playtime for the selected BattleMetrics user...",
    loadSelectedServer: "Load Selected Server Time",
    totalPlaytime: "Total Playtime",
    approxDays: "≈ {value} days",
    totalSessions: "{value} sessions",
    servers: "Servers",
    sessions: "Sessions",
    onlinePlayers: "Online {value}",
    offlineShort: "Offline",
    timesShort: "times",
    noBmFound: "No BattleMetrics candidates were found",
    bmSearchFailed: "BattleMetrics candidate search failed",
    serverLoadFailed: "Failed to load server playtime",
    requestFailed: "Request failed",
    loading: "Loading",
    english: "English",
    chinese: "中文",
  },
};

const DATA_TEXT_EN = {
  "医疗": "Medical",
  "击杀分布": "Kill Breakdown",
  "死亡分布": "Death Breakdown",
  "采集": "Gathering",
  "霰弹枪命中": "Shotgun Hits",
  "弓箭命中": "Arrow Hits",
  "击杀": "Kills",
  "死亡": "Deaths",
  "子弹发射": "Bullets Fired",
  "子弹命中": "Bullet Hits",
  "子弹爆头": "Headshots",
  "受伤": "Wounded",
  "救助玩家": "Revives",
  "自愈": "Self Heal",
  "自伤": "Self Damage",
  "玩家": "Players",
  "科学家": "Scientists",
  "狼": "Wolves",
  "熊": "Bears",
  "野猪": "Boars",
  "鹿": "Stags",
  "马": "Horses",
  "鸡": "Chickens",
  "总死亡": "Total Deaths",
  "自杀": "Suicides",
  "跌落致死": "Fall Deaths",
  "环境死亡": "Environment",
  "被狼击杀": "Killed by Wolves",
  "被熊击杀": "Killed by Bears",
  "金属矿石": "Metal Ore",
  "石头": "Stone",
  "木头": "Wood",
  "废料": "Scrap",
  "低级燃料": "Low Grade Fuel",
  "布": "Cloth",
  "皮革": "Leather",
  "骨片": "Bone Fragments",
  "动物脂肪": "Animal Fat",
  "霰弹发射": "Shells Fired",
  "总命中": "Total Hits",
  "建筑": "Buildings",
  "弓箭发射": "Arrows Fired",
  "其他": "Other",
  "火箭发射": "Rockets Fired",
  "查看箱子": "Containers Opened",
  "物品掉落": "Items Dropped",
  "摧毁油桶": "Barrels Destroyed",
  "学习蓝图": "Blueprints Learned",
  "制作界面": "Craft Menu Opens",
  "建筑建造": "Blocks Placed",
  "建筑升级": "Blocks Upgraded",
  "骑马距离(km)": "Horse Distance (km)",
  "近战攻击": "Melee Strikes",
  "近战投掷": "Thrown Melee",
  "消耗卡路里": "Calories Consumed",
  "消耗水量": "Water Consumed",
  "PVP": "PVP",
  "KD": "KD",
  "爆头率": "Headshot Rate",
  "准确率": "Accuracy",
  "玩家子弹命中": "Player Bullet Hits",
};

const translateText = (lang, text) => lang === "zh" ? text : (DATA_TEXT_EN[text] || text);
const translateSectionTitle = (lang, section) => {
  if (lang === "zh") return section.title;
  if (section.id === "misc") return "Other Stats";
  return DATA_TEXT_EN[section.title] || section.title;
};
const translateStatus = (lang, status) => {
  if (lang === "zh") {
    return ({
      "Online": "在线",
      "In Game": "游戏中",
      "Offline": "离线",
      "Demo": "演示模式",
    })[status] || status;
  }
  return ({
    "在线": "Online",
    "游戏中": "In Game",
    "离线": "Offline",
    "演示模式": "Demo",
  })[status] || status;
};
const translateRarity = (lang, rarity) => lang === "zh" ? (rarityLabel[rarity] || rarity) : (rarityLabelEn[rarity] || rarity);
const pickDisplayName = (item, lang) => lang === "zh" ? (item?.nameCN || item?.name || "—") : (item?.name || item?.nameCN || "—");
const replaceVars = (template, vars = {}) => String(template || "").replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");

// ─── Demo Data ───
const DEMO_DLC = [
  {appid:2650780,name:"Jungle Pack",nameCN:"丛林包",category:"扩展包",description:"A large collection of decorative and functional items in a Jungle theme. Highlights include weapons, armour, storage and more!",headerImage:"",price:{final:12.99,initial:12.99,discountPercent:0,currency:"USD",formatted:"$12.99"},owned:true,boundToAccount:true,tradable:false,storeUrl:"https://store.steampowered.com/app/2650780",releaseDate:"2023",source:"dlc"},
  {appid:1670430,name:"Voice Props Pack",nameCN:"语音道具包",category:"扩展包",description:"Tune in to the Voice Props Pack - a selection of audio themed items for Rust!",headerImage:"",price:{final:9.99,initial:9.99,discountPercent:0,currency:"USD",formatted:"$9.99"},owned:true,boundToAccount:true,tradable:false,storeUrl:"https://store.steampowered.com/app/1670430",releaseDate:"2021",source:"dlc"},
  {appid:2104200,name:"Frontier Pack",nameCN:"前沿边境包",category:"扩展包",description:"The Frontier DLC is a barrel-themed pack for base building.",headerImage:"",price:{final:12.99,initial:12.99,discountPercent:0,currency:"USD",formatted:"$12.99"},owned:true,boundToAccount:true,tradable:false,storeUrl:"https://store.steampowered.com/app/2104200",releaseDate:"2022",source:"dlc"},
  {appid:1364310,name:"Instrument Pack",nameCN:"乐器包",category:"扩展包",description:"Play music in Rust with a variety of instruments.",headerImage:"",price:{final:9.99,initial:9.99,discountPercent:0,currency:"USD",formatted:"$9.99"},owned:false,boundToAccount:true,tradable:false,storeUrl:"https://store.steampowered.com/app/1364310",releaseDate:"2020",source:"dlc"},
  {appid:1409640,name:"Sunburn Pack",nameCN:"烈日灼烧包",category:"扩展包",description:"Summer-themed items for Rust.",headerImage:"",price:{final:9.99,initial:9.99,discountPercent:0,currency:"USD",formatted:"$9.99"},owned:false,boundToAccount:true,tradable:false,storeUrl:"https://store.steampowered.com/app/1409640",releaseDate:"2020",source:"dlc"},
  {appid:2199580,name:"Arctic Pack",nameCN:"极地冰原包",category:"扩展包",description:"Cold-themed survival items.",headerImage:"",price:{final:12.99,initial:12.99,discountPercent:0,currency:"USD",formatted:"$12.99"},owned:false,boundToAccount:true,tradable:false,storeUrl:"https://store.steampowered.com/app/2199580",releaseDate:"2023",source:"dlc"},
  {appid:2963480,name:"Industrial Pack",nameCN:"工业包",category:"扩展包",description:"Industrial-themed building items.",headerImage:"",price:{final:12.99,initial:12.99,discountPercent:0,currency:"USD",formatted:"$12.99"},owned:false,boundToAccount:true,tradable:false,storeUrl:"https://store.steampowered.com/app/2963480",releaseDate:"2024",source:"dlc"},
  {appid:3045860,name:"Warhammer 40K Pack",nameCN:"战锤40K包",category:"联动扩展包",description:"Death Korps of Krieg themed items.",headerImage:"",price:{final:14.99,initial:14.99,discountPercent:0,currency:"USD",formatted:"$14.99"},owned:false,boundToAccount:true,tradable:false,storeUrl:"https://store.steampowered.com/app/3045860",releaseDate:"2025",source:"dlc"},
];

const DEMO = {
  kda: {
    summary:{kills:3847,deaths:2156,headshots:1523,kdRatio:1.78,headshotRate:16.53,accuracy:10.30,bulletsFired:89432,bulletsHit:28741,bulletsHitPlayer:9211,rocketsFired:234,arrowsFired:12543,shotgunFired:4312},
    resources:{metalOre:189400,sulfurOre:84210,stone:876200,wood:1542300,scrap:18340,lowGradeFuel:7520,cloth:234500,leather:98320,boneFragments:6410,animalFat:7850},
    animals:{player:3847,scientist:782,wolf:56,bear:45,boar:123,stag:87,horse:31,chicken:234},
    medical:{wounded:1289,assisted:88,healed:412,selfInflicted:43},
    deaths:{total:2156,suicide:93,fall:146,entity:207,wolf:18,bear:6},
    bullet:{fired:89432,hitsTotal:28741,hitsPlayer:9211,hitsBear:421,hitsBoar:736,hitsStag:518,hitsWolf:249,hitsHorse:127,hitsBuilding:3348,hitsOther:1920},
    arrow:{fired:12543,hitsTotal:7310,hitsPlayer:1488,hitsBear:152,hitsBoar:520,hitsStag:987,hitsWolf:315,hitsHorse:102,hitsBuilding:1404,hitsChicken:638},
    shotgun:{fired:4312,hitsTotal:1883,hitsPlayer:706,hitsHorse:41,hitsBuilding:339},
    building:{placed:45672,upgraded:12345,blueprints:178},
    misc:{rocketsFired:234,grenadesThrown:94,inventoryOpened:2931,itemDrop:548,destroyedBarrels:1172,craftingOpened:6250,mapOpened:4012,cupboardOpened:382,horseDistanceKm:118.7,meleeStrikes:3214,meleeThrown:173,caloriesConsumed:89210,waterConsumed:63420},
    sections:[
      {id:"pvp",title:"PVP",emoji:"⚔️",color:"#ef5350",items:[{id:"kills",label:"击杀",value:3847,icon:"💀"},{id:"deaths",label:"死亡",value:2156,icon:"☠️"},{id:"kd",label:"KD",value:1.78,icon:"📊"},{id:"bulletFired",label:"子弹发射",value:89432,icon:"🔫"},{id:"bulletHitPlayer",label:"子弹命中",value:9211,icon:"🎯"},{id:"headshots",label:"子弹爆头",value:1523,icon:"🔥"}]},
      {id:"medical",title:"医疗",emoji:"🩹",color:"#66bb6a",items:[{id:"wounded",label:"受伤",value:1289,icon:"🩸"},{id:"assisted",label:"救助玩家",value:88,icon:"💉"},{id:"healed",label:"自愈",value:412,icon:"🧰"},{id:"selfInflicted",label:"自伤",value:43,icon:"⚠️"}]},
      {id:"kills",title:"击杀分布",emoji:"🐾",color:"#ff7043",items:[{id:"player",label:"玩家",value:3847,icon:"🧍"},{id:"scientist",label:"科学家",value:782,icon:"🧪"},{id:"wolf",label:"狼",value:56,icon:"🐺"},{id:"bear",label:"熊",value:45,icon:"🐻"},{id:"boar",label:"野猪",value:123,icon:"🐗"},{id:"stag",label:"鹿",value:87,icon:"🦌"},{id:"horse",label:"马",value:31,icon:"🐎"},{id:"chicken",label:"鸡",value:234,icon:"🐔"}]},
      {id:"deaths",title:"死亡分布",emoji:"☠️",color:"#b0bec5",items:[{id:"total",label:"总死亡",value:2156,icon:"💀"},{id:"suicide",label:"自杀",value:93,icon:"🪦"},{id:"fall",label:"跌落致死",value:146,icon:"🧗"},{id:"entity",label:"环境死亡",value:207,icon:"🌩️"},{id:"wolf",label:"被狼击杀",value:18,icon:"🐺"},{id:"bear",label:"被熊击杀",value:6,icon:"🐻"}]},
      {id:"resources",title:"采集",emoji:"⛏️",color:"#26a69a",items:[{id:"metalOre",label:"金属矿石",value:189400,icon:"🪨"},{id:"stone",label:"石头",value:876200,icon:"🧱"},{id:"wood",label:"木头",value:1542300,icon:"🪵"},{id:"scrap",label:"废料",value:18340,icon:"🧲"},{id:"lowGradeFuel",label:"低级燃料",value:7520,icon:"🛢️"},{id:"cloth",label:"布",value:234500,icon:"🧶"},{id:"leather",label:"皮革",value:98320,icon:"🧥"},{id:"boneFragments",label:"骨片",value:6410,icon:"🦴"},{id:"animalFat",label:"动物脂肪",value:7850,icon:"🥩"}]},
      {id:"shotgun",title:"霰弹枪命中",emoji:"💥",color:"#8d6e63",items:[{id:"fired",label:"霰弹发射",value:4312,icon:"🔫"},{id:"hitsTotal",label:"总命中",value:1883,icon:"🎯"},{id:"hitsPlayer",label:"玩家",value:706,icon:"🧍"},{id:"hitsBuilding",label:"建筑",value:339,icon:"🏠"},{id:"hitsHorse",label:"马",value:41,icon:"🐎"}]},
      {id:"arrow",title:"弓箭命中",emoji:"🏹",color:"#7cb342",items:[{id:"fired",label:"弓箭发射",value:12543,icon:"🏹"},{id:"hitsPlayer",label:"玩家",value:1488,icon:"🧍"},{id:"hitsWolf",label:"狼",value:315,icon:"🐺"},{id:"hitsBear",label:"熊",value:152,icon:"🐻"},{id:"hitsBoar",label:"野猪",value:520,icon:"🐗"},{id:"hitsStag",label:"鹿",value:987,icon:"🦌"},{id:"hitsHorse",label:"马",value:102,icon:"🐎"},{id:"hitsChicken",label:"鸡",value:638,icon:"🐔"},{id:"hitsBuilding",label:"建筑",value:1404,icon:"🏠"}]},
      {id:"bullet",title:"子弹命中",emoji:"🔸",color:"#42a5f5",items:[{id:"fired",label:"子弹发射",value:89432,icon:"🔫"},{id:"hitsPlayer",label:"玩家",value:9211,icon:"🧍"},{id:"hitsWolf",label:"狼",value:249,icon:"🐺"},{id:"hitsBear",label:"熊",value:421,icon:"🐻"},{id:"hitsBoar",label:"野猪",value:736,icon:"🐗"},{id:"hitsStag",label:"鹿",value:518,icon:"🦌"},{id:"hitsHorse",label:"马",value:127,icon:"🐎"},{id:"hitsBuilding",label:"建筑",value:3348,icon:"🏠"},{id:"hitsOther",label:"其他",value:1920,icon:"📦"}]},
      {id:"misc",title:"其他",emoji:"🧰",color:"#ab47bc",items:[{id:"rocketsFired",label:"火箭发射",value:234,icon:"🚀"},{id:"inventoryOpened",label:"查看箱子",value:2931,icon:"📦"},{id:"itemDrop",label:"物品掉落",value:548,icon:"🎒"},{id:"destroyedBarrels",label:"摧毁油桶",value:1172,icon:"🛢️"},{id:"blueprints",label:"学习蓝图",value:178,icon:"📘"},{id:"craftingOpened",label:"制作界面",value:6250,icon:"🛠️"},{id:"placed",label:"建筑建造",value:45672,icon:"🏗️"},{id:"upgraded",label:"建筑升级",value:12345,icon:"🧱"},{id:"horseDistanceKm",label:"骑马距离(km)",value:118.7,icon:"🐎"},{id:"meleeStrikes",label:"近战攻击",value:3214,icon:"🔪"},{id:"meleeThrown",label:"近战投掷",value:173,icon:"🪓"},{id:"caloriesConsumed",label:"消耗卡路里",value:89210,icon:"🍖"},{id:"waterConsumed",label:"消耗水量",value:63420,icon:"💧"}]},
    ],
  },
  inventory: {
    skins: [
      {name:"Tempered AK47",nameCN:"回火 AK47",rarity:"legendary",price:48.50,tradable:true,marketable:true,iconUrl:"",type:"步枪皮肤",source:"steam-web+scmm",priceSource:"scmm-profile",quantity:1},
      {name:"Alien Red Hoodie",nameCN:"外星红色帽衫",rarity:"epic",price:32.20,tradable:true,marketable:true,iconUrl:"",type:"服装",source:"steam-web+scmm",priceSource:"scmm-profile",quantity:1},
      {name:"Jungle Pack",nameCN:"丛林包",rarity:"common",price:0,tradable:false,marketable:false,iconUrl:"",type:"扩展包",source:"steam-web",priceSource:null,quantity:1},
      {name:"Medieval Pack",nameCN:"中世纪包",rarity:"common",price:0,tradable:false,marketable:false,iconUrl:"",type:"扩展包",source:"steam-web",priceSource:null,quantity:1},
    ],
    dlcs: DEMO_DLC,
    storeCatalog:[
      {detailId:"10273",name:"Jungle Pack",nameCN:"丛林包",category:"扩展包",priceText:"$12.99",priceValue:12.99,owned:true,scmmAvailable:false,storeUrl:"https://store.steampowered.com/itemstore/252490/detail/10273/",source:"steam-itemstore"},
      {detailId:"10294",name:"Medieval Pack",nameCN:"中世纪包",category:"扩展包",priceText:"$12.99",priceValue:12.99,owned:true,scmmAvailable:false,storeUrl:"https://store.steampowered.com/itemstore/252490/detail/10294/",source:"steam-itemstore"},
      {detailId:"10435",name:"Storage Box Pack",nameCN:"储物箱包",category:"扩展包",priceText:"$17.99",priceValue:17.99,owned:false,scmmAvailable:false,storeUrl:"https://store.steampowered.com/itemstore/252490/detail/10435/",source:"steam-itemstore"},
    ],
    skinsSummary:{totalItems:204,distinctItems:76,totalValue:225.25,tradableValue:174.00,rarityCounts:{legendary:1,epic:1,common:2},source:"steam-web+scmm",steamWebOnlyDistinct:2,steamWebOnlyItems:2,pricedByScmmDistinct:2,pricedByScmmItems:2},
    dlcSummary:{totalDlcs:8,ownedCount:3,notOwnedCount:5,ownedValue:35.97},
    storeSummary:{totalItems:3,ownedCount:2,notOwnedCount:1,steamWebOnlyCount:3,ownedValue:25.98,available:true},
    totalSummary:{totalValue:261.22,skinsValue:225.25,dlcValue:35.97,tradableValue:174.00,totalItems:204,distinctItems:76,totalDlcs:8,ownedDlcs:3,storeCatalogItems:3,ownedStoreItems:2,ownedStoreValue:25.98,currency:"USD"},
  },
  servers: {
    servers:[
      {name:"Rustafied.com - US Long",totalHours:1247.5,lastSeen:"2026-04-02T10:30:00Z",country:"US",players:"287/300",status:"online",sessionCount:342},
      {name:"[CN] 官方服务器 Shanghai #1",totalHours:856.2,lastSeen:"2026-04-01T22:00:00Z",country:"CN",players:"198/250",status:"online",sessionCount:215},
      {name:"Rustoria.co - EU Long",totalHours:423.8,lastSeen:"2026-03-28T15:00:00Z",country:"DE",players:"245/300",status:"online",sessionCount:98},
      {name:"[Asia] Facepunch Small 1",totalHours:198.6,lastSeen:"2026-04-03T02:00:00Z",country:"SG",players:"142/150",status:"online",sessionCount:54},
    ],
    summary:{totalHours:2726.1,totalDays:113.6,serverCount:4,totalSessions:709},
  },
};

// ─── Sub Components ───
function StatCard({icon,label,value,color}) {
  const [h,setH]=useState(false);
  return (
    <div className="neon-card neon-card-interactive" onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{background:h?`${color}0d`:"rgba(255,255,255,.025)",borderRadius:14,padding:"16px 14px",textAlign:"center",border:`1px solid ${h?color+"44":"rgba(255,255,255,.04)"}`,transition:"all .25s",cursor:"default",position:"relative",overflow:"hidden",minHeight:118}}>
      {h&&<div style={{position:"absolute",inset:0,background:`radial-gradient(circle at 50% 0%,${color}15,transparent 70%)`}}/>}
      <div style={{position:"relative"}}>
        <div style={{fontSize:20,marginBottom:6}}>{icon}</div>
        <div style={{fontSize:"clamp(20px,2.2vw,28px)",fontWeight:800,color,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.15}}>{value}</div>
        <div style={{fontSize:11,color:"#78909c",marginTop:6,lineHeight:1.35}}>{label}</div>
      </div>
    </div>
  );
}
function MiniStat({icon,label,value}) {
  return (<div className="neon-card neon-mini-card neon-card-interactive" style={{background:"rgba(255,255,255,.02)",borderRadius:10,padding:"12px 10px",border:"1px solid rgba(255,255,255,.04)",textAlign:"center",minHeight:84}}><div style={{fontSize:16,marginBottom:4}}>{icon}</div><div style={{fontSize:"clamp(14px,1.6vw,18px)",fontWeight:700,color:"#b0bec5",fontFamily:"'JetBrains Mono',monospace",lineHeight:1.2}}>{value}</div><div style={{fontSize:10,color:"#546e7a",marginTop:6,lineHeight:1.35}}>{label}</div></div>);
}
function SectionTitle({emoji,title}) {
  return <div style={{fontSize:13,fontWeight:600,color:"#90a4ae",marginBottom:10,letterSpacing:1,display:"flex",alignItems:"center",gap:6}}><span>{emoji}</span>{title}</div>;
}
function ErrorBox({msg}) {
  return <div className="neon-card" style={{padding:"20px 24px",borderRadius:14,background:"rgba(239,83,80,.06)",border:"1px solid rgba(239,83,80,.15)",color:"#ef9a9a",fontSize:13,textAlign:"center"}}><div style={{fontSize:28,marginBottom:8}}>⚠️</div>{msg}</div>;
}

function SectionMetric({item,accent,formatValue=fmtMetric}) {
  return (
    <div className="neon-card neon-card-interactive neon-metric-card" style={{padding:"12px 12px 10px",borderRadius:12,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)",minHeight:88}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8}}>
        <span style={{fontSize:16}}>{item.icon||"•"}</span>
        <span style={{fontSize:11,color:"#78909c",lineHeight:1.35,overflowWrap:"anywhere"}}>{item.label}</span>
      </div>
      <div style={{fontSize:"clamp(16px,2vw,24px)",fontWeight:800,color:accent,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.15,overflowWrap:"anywhere"}}>{formatValue(item.value)}</div>
    </div>
  );
}

function StatsSection({section, layout="grid", formatValue=fmtMetric}) {
  const gridTemplateColumns = layout==="stack"
    ? "1fr"
    : layout==="flow"
      ? "repeat(auto-fit,minmax(150px,1fr))"
      : "repeat(auto-fit,minmax(140px,1fr))";
  return (
    <div className="neon-panel" style={{background:"rgba(255,255,255,.02)",borderRadius:18,padding:"18px 18px 16px",border:"1px solid rgba(255,255,255,.05)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>{section.emoji}</span>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#eceff1"}}>{section.title}</div>
            <div style={{fontSize:10,color:"#546e7a",letterSpacing:.8,textTransform:"uppercase"}}>{section.id}</div>
          </div>
        </div>
        <div style={{width:42,height:3,borderRadius:999,background:section.color||"#78909c"}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns,gap:10}}>
        {section.items.map((item)=><SectionMetric key={item.id} item={item} accent={section.color||"#90a4ae"} formatValue={formatValue}/>)}
      </div>
    </div>
  );
}

function KdaProfileCard({player,inventory,servers,summary,lang,locale,t,formatMoneyValue}) {
  const totalValue = inventory?.totalSummary?.totalValue;
  const serverHours = servers?.summary?.totalHours;
  const score = Math.min(100, Math.round(
    Math.min((summary?.kdRatio||0)*18, 35) +
    Math.min((player?.playtimeHours||0)/60, 20) +
    Math.min((serverHours||0)/120, 20) +
    Math.min((totalValue||0)/20, 15) +
    Math.min((summary?.headshotRate||0)/2, 10)
  ));

  return (
    <div className="neon-panel neon-panel-ember" style={{background:"linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015))",borderRadius:18,padding:"20px",border:"1px solid rgba(255,255,255,.05)",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        {player?.avatarMedium?<img src={player.avatarMedium} alt="" style={{width:62,height:62,borderRadius:16,border:"2px solid rgba(255,255,255,.08)"}}/>:<div style={{width:62,height:62,borderRadius:16,background:"linear-gradient(135deg,#00e5ff,#7c4dff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:800,color:"#fff"}}>{player?.name?.[0]?.toUpperCase()||"?"}</div>}
        <div style={{minWidth:0}}>
          <div style={{fontSize:"clamp(17px,2vw,21px)",fontWeight:800,color:"#eceff1",overflowWrap:"anywhere"}}>{player?.name || (lang === "zh" ? "玩家画像" : "Player Profile")}</div>
          <div style={{fontSize:11,color:"#546e7a",fontFamily:"'JetBrains Mono',monospace",overflowWrap:"anywhere"}}>{player?.steamId||"—"}</div>
          <div style={{fontSize:11,color:"#90a4ae",marginTop:4,lineHeight:1.4}}>{player?.country||"—"} · {t("playerCreated")} {fmtDate(player?.created, locale)}</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        <div className="neon-card neon-card-interactive" style={{padding:"12px",borderRadius:12,background:"rgba(66,165,245,.08)",border:"1px solid rgba(66,165,245,.18)"}}><div style={{fontSize:10,color:"#78909c"}}>{t("rustHours")}</div><div style={{fontSize:20,fontWeight:800,color:"#42a5f5",fontFamily:"'JetBrains Mono',monospace"}}>{fmtHours(player?.playtimeHours, locale)}</div></div>
        <div className="neon-card neon-card-interactive" style={{padding:"12px",borderRadius:12,background:"rgba(255,193,7,.08)",border:"1px solid rgba(255,193,7,.18)"}}><div style={{fontSize:10,color:"#78909c"}}>{t("recentTwoWeeks")}</div><div style={{fontSize:20,fontWeight:800,color:"#ffc107",fontFamily:"'JetBrains Mono',monospace"}}>{fmtHours(player?.playtimeTwoWeeksHours, locale)}</div></div>
        <div className="neon-card neon-card-interactive" style={{padding:"12px",borderRadius:12,background:"rgba(239,83,80,.08)",border:"1px solid rgba(239,83,80,.18)"}}><div style={{fontSize:10,color:"#78909c"}}>{t("unlockedAchievements")}</div><div style={{fontSize:20,fontWeight:800,color:"#ef5350",fontFamily:"'JetBrains Mono',monospace"}}>{fmtFull(player?.achievementsCount, locale)}</div></div>
        <div className="neon-card neon-card-interactive" style={{padding:"12px",borderRadius:12,background:"rgba(102,187,106,.08)",border:"1px solid rgba(102,187,106,.18)"}}><div style={{fontSize:10,color:"#78909c"}}>{t("inventoryValue")}</div><div style={{fontSize:20,fontWeight:800,color:"#66bb6a",fontFamily:"'JetBrains Mono',monospace"}}>{formatMoneyValue(totalValue)}</div></div>
        <div className="neon-card neon-card-interactive" style={{padding:"12px",borderRadius:12,background:"rgba(171,71,188,.08)",border:"1px solid rgba(171,71,188,.18)"}}><div style={{fontSize:10,color:"#78909c"}}>{t("serverPlaytime")}</div><div style={{fontSize:20,fontWeight:800,color:"#ce93d8",fontFamily:"'JetBrains Mono',monospace"}}>{fmtServerDuration(serverHours, lang, locale)}</div></div>
        <div className="neon-card neon-card-interactive" style={{padding:"12px",borderRadius:12,background:"rgba(121,134,203,.08)",border:"1px solid rgba(121,134,203,.18)"}}><div style={{fontSize:10,color:"#78909c"}}>{t("accountAge")}</div><div style={{fontSize:20,fontWeight:800,color:"#9fa8da",fontFamily:"'JetBrains Mono',monospace"}}>{yearsSince(player?.created, lang, locale)}</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        <div className="neon-card neon-card-interactive" style={{padding:"12px",borderRadius:12,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)"}}><div style={{fontSize:10,color:"#78909c"}}>{t("recentActive")}</div><div style={{fontSize:15,fontWeight:700,color:"#eceff1",lineHeight:1.35,overflowWrap:"anywhere"}}>{fmtDateTime(player?.lastLogoffAt||player?.lastLogoff, locale)}</div></div>
        <div className="neon-card neon-card-interactive" style={{padding:"12px",borderRadius:12,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)"}}><div style={{fontSize:10,color:"#78909c"}}>{t("profileOverview")}</div><div style={{fontSize:15,fontWeight:700,color:"#eceff1",lineHeight:1.35}}>{t("profileOverviewValue")}</div></div>
      </div>
      <div className="neon-card neon-card-interactive" style={{padding:"14px 16px",borderRadius:14,background:"linear-gradient(135deg,rgba(0,229,255,.12),rgba(124,77,255,.12))",border:"1px solid rgba(0,229,255,.16)"}}>
        <div style={{fontSize:10,color:"#78909c",letterSpacing:1.4,textTransform:"uppercase",marginBottom:6}}>{t("compositeScore")}</div>
        <div style={{display:"flex",alignItems:"baseline",gap:10}}>
          <div style={{fontSize:34,fontWeight:900,color:"#6ef7ff",fontFamily:"'JetBrains Mono',monospace"}}>{score}</div>
          <div style={{fontSize:12,color:"#b0bec5"}}>/ 100</div>
        </div>
        <div style={{fontSize:11,color:"#90a4ae",marginTop:6}}>{t("compositeScoreNote")}</div>
      </div>
    </div>
  );
}

// ─── KDA Panel ───
function KDAPanel({data,player,inventory,servers,lang,locale,t,formatMoneyValue}) {
  if(data.error) return <ErrorBox msg={data.error}/>;
  const s=data.summary;
  const kc=s.kdRatio>=3?"#66bb6a":s.kdRatio>=1.5?"#ffa726":"#ef5350";
  const rating = lang === "zh"
    ? (s.kdRatio>=4?"🏆 传奇猎手":s.kdRatio>=2.5?"⚔️ 精英战士":s.kdRatio>=1.5?"🛡️ 老练玩家":s.kdRatio>=1?"🎯 合格战士":"🌱 成长中")
    : (s.kdRatio>=4?"🏆 Legendary Hunter":s.kdRatio>=2.5?"⚔️ Elite Fighter":s.kdRatio>=1.5?"🛡️ Seasoned Player":s.kdRatio>=1?"🎯 Solid Fighter":"🌱 Rising");
  const sections=data.sections||[];
  const localizedSections = lang === "zh"
    ? sections
    : sections.map((section)=>({
        ...section,
        title: translateSectionTitle(lang, section),
        items: (section.items || []).map((item)=>({
          ...item,
          label: translateText(lang, item.label),
        })),
      }));
  return (
    <div style={{animation:"fadeIn .5s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(360px,1fr))",gap:16,marginBottom:18,alignItems:"stretch"}}>
        <KdaProfileCard player={player} inventory={inventory} servers={servers} summary={s} lang={lang} locale={locale} t={t} formatMoneyValue={formatMoneyValue}/>
        <div className="neon-panel neon-panel-accent" style={{background:`linear-gradient(135deg,${kc}12,rgba(30,30,50,.4))`,borderRadius:18,padding:"24px 28px",border:`1px solid ${kc}22`,position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:22,flexWrap:"wrap"}}>
            <div style={{position:"relative",width:80,height:80}}>
              <svg viewBox="0 0 80 80" style={{transform:"rotate(-90deg)"}}><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.04)" strokeWidth="6"/><circle cx="40" cy="40" r="34" fill="none" stroke={kc} strokeWidth="6" strokeDasharray={`${Math.min(s.kdRatio/5,1)*213.6} 213.6`} strokeLinecap="round"/></svg>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:kc,fontFamily:"'JetBrains Mono',monospace"}}>{s.kdRatio}</div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:"#78909c",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>{t("kdRating")}</div>
              <div style={{fontSize:"clamp(22px,2.4vw,30px)",fontWeight:800,color:"#eceff1"}}>{rating}</div>
              <div style={{fontSize:12,color:"#78909c",marginTop:4,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.5}}>
                {fmtFull(s.kills, locale)} {translateText(lang, "击杀")} · {fmtFull(s.deaths, locale)} {translateText(lang, "死亡")} · {fmtFull(s.headshots, locale)} {lang === "zh" ? "爆头" : "headshots"}
              </div>
              <div style={{fontSize:11,color:"#90a4ae",marginTop:6,lineHeight:1.5}}>
                {t("accuracyFormula")}
                <br/>
                {t("headshotFormula")}
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginTop:20}}>
            <StatCard icon="💀" label={translateText(lang, "击杀")} value={fmtFull(s.kills, locale)} color="#ef5350"/>
            <StatCard icon="☠️" label={translateText(lang, "死亡")} value={fmtFull(s.deaths, locale)} color="#78909c"/>
            <StatCard icon="🎯" label={lang === "zh" ? "爆头次数/击杀" : "Headshots / Kills"} value={`${fmtFull(s.headshots, locale)} / ${fmtFull(s.kills, locale)}`} color="#ab47bc"/>
            <StatCard icon="📊" label="KD" value={s.kdRatio} color={kc}/>
            <StatCard icon="🔫" label={translateText(lang, "准确率")} value={fmtPercent(s.accuracy, locale)} color="#42a5f5"/>
            <StatCard icon="🧠" label={translateText(lang, "爆头率")} value={fmtPercent(s.headshotRate, locale)} color="#ab47bc"/>
            <StatCard icon="🚀" label={translateText(lang, "火箭发射")} value={fmtFull(s.rocketsFired, locale)} color="#ff7043"/>
          </div>
        </div>
      </div>
      <div className="neon-panel" style={{background:"rgba(255,255,255,.02)",borderRadius:18,padding:"16px 18px",border:"1px solid rgba(255,255,255,.05)",marginBottom:18}}>
        <SectionTitle emoji="📌" title={t("combatOverview")}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
          {[
            ["🔫",translateText(lang, "子弹发射"),fmtFull(s.bulletsFired, locale)],
            ["🎯",translateText(lang, "玩家子弹命中"),fmtFull(s.bulletsHitPlayer, locale)],
            ["💥",lang === "zh" ? "子弹总命中" : "Total Bullet Hits",fmtFull(s.bulletsHit, locale)],
            ["🏹",translateText(lang, "弓箭发射"),fmtFull(s.arrowsFired, locale)],
            ["🧨",translateText(lang, "霰弹发射"),fmtFull(s.shotgunFired, locale)],
            ["🚀",translateText(lang, "火箭发射"),fmtFull(s.rocketsFired, locale)],
            ["🧠",translateText(lang, "爆头率"),fmtPercent(s.headshotRate, locale)],
            ["📏",translateText(lang, "准确率"),fmtPercent(s.accuracy, locale)],
          ].map(([i,l,v],x)=><MiniStat key={x} icon={i} label={l} value={v}/>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>
        {localizedSections.map((section)=><StatsSection key={section.id} section={section} layout="flow" formatValue={(value)=>fmtFull(value, locale)}/>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  库存面板
// ═══════════════════════════════════════════════════
function InventoryPanel({data,lang,locale,t,formatMoneyValue}) {
  if(data.error) return <ErrorBox msg={data.error}/>;
  const [view,setView]=useState("all"); // all | steamOnly | store
  const [sortBy,setSortBy]=useState("price");

  const ts=data.totalSummary||{};
  const ss=data.skinsSummary||{};
  const storeSummary=data.storeSummary||{};
  const skins=data.skins||[];
  const storeCatalog=data.storeCatalog||[];
  const matchedStore=storeCatalog.filter((item)=>item.owned);
  const filteredSkins=skins.filter((item)=>view==="steamOnly"?!String(item.source||"").includes("scmm"):true);
  const sortedSkins=[...filteredSkins].sort((a,b)=>sortBy==="name"?pickDisplayName(a, lang).localeCompare(pickDisplayName(b, lang), locale):(b.price||0)-(a.price||0));
  const sortedStore=[...matchedStore].sort((a,b)=>{
    return pickDisplayName(a, lang).localeCompare(pickDisplayName(b, lang), locale);
  });

  return (
    <div style={{animation:"fadeIn .5s ease"}}>
      {/* ── 总价值 Hero ── */}
      <div className="neon-panel neon-panel-gold" style={{background:"linear-gradient(135deg,rgba(0,229,255,.10),rgba(124,77,255,.14))",borderRadius:18,padding:"22px 26px",marginBottom:18,border:"1px solid rgba(0,229,255,.14)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:14,flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:11,color:"#78909c",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>{t("totalAssetValue")}</div>
            <div style={{fontSize:"clamp(30px,4vw,44px)",fontWeight:900,color:"#6ef7ff",fontFamily:"'JetBrains Mono',monospace"}}>{formatMoneyValue(ts.totalValue)}</div>
          </div>
          <div style={{display:"flex",gap:18,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:"#78909c"}}>{t("tradable")}</div>
              <div style={{fontSize:18,fontWeight:700,color:"#66bb6a",fontFamily:"'JetBrains Mono',monospace"}}>{formatMoneyValue(ts.tradableValue)}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:"#78909c"}}>{t("storeOwnedValue")}</div>
              <div style={{fontSize:18,fontWeight:700,color:"#ab47bc",fontFamily:"'JetBrains Mono',monospace"}}>{formatMoneyValue(storeSummary.ownedValue)}</div>
            </div>
          </div>
        </div>
        {ss.error&&(
          <div style={{marginBottom:12,padding:"10px 12px",borderRadius:12,background:"rgba(255,167,38,.08)",border:"1px solid rgba(255,167,38,.16)",color:"#ffcc80",fontSize:12,lineHeight:1.5}}>
            {ss.error&&<div>{t("inventoryUnavailable")}：{ss.error}</div>}
          </div>
        )}
        {storeSummary.error&&(
          <div style={{marginBottom:12,padding:"10px 12px",borderRadius:12,background:"rgba(66,165,245,.08)",border:"1px solid rgba(66,165,245,.16)",color:"#90caf9",fontSize:12,lineHeight:1.5}}>
            {t("storeUnavailable")}：{storeSummary.error}
          </div>
        )}
        {/* Value breakdown */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <ValueChip label={t("inventoryWorth")} value={formatMoneyValue(ts.skinsValue)} color="#6ef7ff" count={lang==="zh"?`${fmtFull(ss.totalItems||0, locale)}件 / ${fmtFull(ss.distinctItems||0, locale)}种`:`${fmtFull(ss.totalItems||0, locale)} items / ${fmtFull(ss.distinctItems||0, locale)} unique`}/>
          <ValueChip label={t("steamWebOnly")} value={fmtFull(ss.steamWebOnlyDistinct||0, locale)} color="#42a5f5" count={lang==="zh"?`${fmtFull(ss.steamWebOnlyItems||0, locale)}件`:`${fmtFull(ss.steamWebOnlyItems||0, locale)} items`}/>
          <ValueChip label={t("scmmPriced")} value={fmtFull(ss.pricedByScmmDistinct||0, locale)} color="#66bb6a" count={lang==="zh"?`${fmtFull(ss.pricedByScmmItems||0, locale)}件`:`${fmtFull(ss.pricedByScmmItems||0, locale)} items`}/>
          <ValueChip label={t("currentStore")} value={fmtFull(storeSummary.ownedCount||0, locale)} color="#ab47bc" count={lang==="zh"?`${t("matchedCount")} ${fmtFull(storeSummary.ownedCount||0, locale)} 项`:`${t("matchedCount")} ${fmtFull(storeSummary.ownedCount||0, locale)}`}/>
          <ValueChip label={t("nonTradableValue")} value={formatMoneyValue(storeSummary.ownedValue)} color="#8e24aa" count={t("currentStoreMatched")}/>
          {Object.entries(ss.rarityCounts||{}).map(([r,c])=>(
            <div key={r} style={{padding:"3px 10px",borderRadius:12,background:RC[r]?.bg,border:`1px solid ${RC[r]?.bd}44`,fontSize:11,color:RC[r]?.tx,fontWeight:600}}>{translateRarity(lang, r)} ×{c}</div>
          ))}
        </div>
      </div>

      {/* ── View Tabs ── */}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {[["all",t("allAssets"),ts.totalItems||0],["steamOnly",t("steamWebOnly"),ss.steamWebOnlyDistinct||0],["store",t("storeCatalog"),storeSummary.ownedCount||0]].map(([v,l,n])=>(
          <button key={v} className={`neon-button neon-filter-button ${view===v?"active":""}`} onClick={()=>setView(v)} style={{
            padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
            background:view===v?"rgba(0,229,255,.12)":"rgba(255,255,255,.03)",
            color:view===v?"#6ef7ff":"#7e8aab",transition:"all .2s",
          }}>{l} ({n})</button>
        ))}
      </div>

      {/* ── Skins Section ── */}
      {(view==="all"||view==="steamOnly")&&sortedSkins.length>0&&(
        <div>
          <SectionTitle emoji="🎨" title={view==="steamOnly"
            ? `${t("steamOnlyAssets")} (${lang==="zh"?`${fmtFull(ss.steamWebOnlyDistinct||sortedSkins.length, locale)}种`:`${fmtFull(ss.steamWebOnlyDistinct||sortedSkins.length, locale)} unique`})`
            : `${t("mergedInventory")} (${lang==="zh"?`${fmtFull(ss.totalItems||0, locale)}件 / ${fmtFull(ss.distinctItems||sortedSkins.length, locale)}种`:`${fmtFull(ss.totalItems||0, locale)} items / ${fmtFull(ss.distinctItems||sortedSkins.length, locale)} unique`})`}/>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {[["price",t("sortByPrice")],["name",t("sortByName")]].map(([v,l])=>(
              <button key={v} className={`neon-button neon-filter-button ${sortBy===v?"active":""}`} onClick={()=>setSortBy(v)} style={{padding:"5px 14px",borderRadius:8,border:"none",cursor:"pointer",background:sortBy===v?"rgba(0,229,255,.12)":"rgba(255,255,255,.03)",color:sortBy===v?"#6ef7ff":"#8a94b4",fontSize:12,fontWeight:600}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {sortedSkins.map((item,i)=>{
              const rc=RC[item.rarity]||RC.common;
              const sourceLabel = lang === "zh"
                ? (item.source==="steam-web+scmm"?"Steam 网页 + SCMM":item.source==="steam-web+market"?"Steam 网页 + 市场":item.source==="scmm-profile"?"SCMM":"Steam 网页")
                : (item.source==="steam-web+scmm"?"Steam Web + SCMM":item.source==="steam-web+market"?"Steam Web + Market":item.source==="scmm-profile"?"SCMM":"Steam Web");
              return (
                <div key={i} className="neon-card neon-row neon-card-interactive" style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:rc.bg,borderRadius:12,border:`1px solid ${rc.bd}25`,transition:"all .2s",flexWrap:"wrap"}}>
                  {item.iconUrl?<img src={item.iconUrl} alt="" style={{width:42,height:42,borderRadius:8,background:"rgba(0,0,0,.3)"}}/>:<div style={{width:42,height:42,borderRadius:8,background:"rgba(0,0,0,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎨</div>}
                  <div style={{flex:1,minWidth:220}}>
                    <div style={{fontSize:14,fontWeight:700,color:rc.tx,overflowWrap:"anywhere"}}>{pickDisplayName(item, lang)}</div>
                    {(item.nameCN&&item.nameCN!==item.name)&&<div style={{fontSize:11,color:"#78909c",marginTop:2,overflowWrap:"anywhere"}}>{lang==="zh" ? item.name : item.nameCN}</div>}
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                      <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>×{fmtFull(item.quantity||1, locale)}</span>
                      <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>{lang==="zh" ? (item.type || t("inventoryItem")) : (item.typeEN || item.type || t("inventoryItem"))}</span>
                      <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>{sourceLabel}</span>
                      {!item.tradable&&<span style={{fontSize:10,color:"#ffcc80",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,193,7,.18)"}}>{t("accountBound")}</span>}
                    </div>
                  </div>
                  <div style={{fontSize:15,fontWeight:700,color:item.price>10?"#ffc107":"#78909c",fontFamily:"'JetBrains Mono',monospace",marginLeft:"auto",minWidth:120,textAlign:"right"}}>
                    <div>{item.price>0?formatMoneyValue(item.price):"—"}</div>
                    <div style={{fontSize:10,color:"#546e7a",marginTop:4}}>{item.priceSource||t("unpriced")}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(view==="all"||view==="store")&&sortedStore.length>0&&(
        <div style={{marginTop:view==="all"?18:0}}>
          <SectionTitle emoji="🛍️" title={`${t("storeCatalog")} (${lang==="zh"?`${fmtFull(storeSummary.ownedCount||sortedStore.length, locale)}项`:`${fmtFull(storeSummary.ownedCount||sortedStore.length, locale)} items`})`}/>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {sortedStore.map((item,i)=>(
              <div key={i} className="neon-card neon-row neon-card-interactive" style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"rgba(102,187,106,.08)",borderRadius:12,border:"1px solid rgba(102,187,106,.18)",flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:220}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#a5d6a7",overflowWrap:"anywhere"}}>{pickDisplayName(item, lang)}</div>
                  {(item.nameCN&&item.nameCN!==item.name)&&<div style={{fontSize:11,color:"#78909c",marginTop:2,overflowWrap:"anywhere"}}>{lang==="zh" ? item.name : item.nameCN}</div>}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                    <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>{lang==="zh" ? (item.category||t("storeItem")) : (item.categoryEN || item.category || t("storeItem"))}</span>
                    <span style={{fontSize:10,color:"#a5d6a7",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(102,187,106,.2)"}}>{t("hitInInventory")}</span>
                    <span style={{fontSize:10,color:item.scmmAvailable?"#66bb6a":"#42a5f5",padding:"2px 8px",borderRadius:999,border:`1px solid ${item.scmmAvailable?"rgba(102,187,106,.18)":"rgba(66,165,245,.18)"}`}}>{item.scmmAvailable?t("scmmAvailable"):t("steamWebExclusive")}</span>
                  </div>
                </div>
                <div style={{marginLeft:"auto",textAlign:"right",minWidth:120}}>
                  <div style={{fontSize:15,fontWeight:800,color:"#ffc107",fontFamily:"'JetBrains Mono',monospace"}}>{typeof item.priceValue === "number" ? formatMoneyValue(item.priceValue) : (item.priceText||"—")}</div>
                  {item.storeUrl&&<a href={item.storeUrl} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#64b5f6",textDecoration:"none"}}>{t("openStore")}</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ValueChip({label,value,color,count}) {
  return (
    <div className="neon-chip" style={{padding:"4px 12px",borderRadius:10,background:`${color}0a`,border:`1px solid ${color}22`,display:"flex",alignItems:"center",gap:6}}>
      <span style={{fontSize:12,fontWeight:700,color,fontFamily:"'JetBrains Mono',monospace"}}>{value}</span>
      <span style={{fontSize:10,color:"#78909c"}}>{label}</span>
      {count&&<span style={{fontSize:9,color:"#455a64"}}>({count})</span>}
    </div>
  );
}

// ─── Server Panel ───
function ServerPanel({data, candidatesPayload, selectedBmId, onSelectBm, onLoadSelected, onResetSelection, loading, error, lang, locale, t}) {
  const candidates = candidatesPayload?.candidates || [];
  const selectedCandidate = candidates.find((candidate)=>candidate.bmId===selectedBmId) || null;

  if((!data || data.error) && error) return <ErrorBox msg={error}/>;
  if(!data && candidates.length===0){
    return (
      <div style={{background:"rgba(255,255,255,.02)",borderRadius:18,padding:"22px",border:"1px solid rgba(255,255,255,.05)"}}>
        <div style={{fontSize:14,fontWeight:700,color:"#eceff1",marginBottom:8}}>{t("noBmCandidatesTitle")}</div>
        <div style={{fontSize:12,color:"#78909c",lineHeight:1.6}}>{t("noBmCandidatesHint")}</div>
      </div>
    );
  }

  const maxH=data ? Math.max(...data.servers.map(s=>s.totalHours),1) : 1;
  const sm=data?.summary;
  return (
    <div style={{animation:"fadeIn .5s ease"}}>
      <div className="neon-card" style={{padding:"14px 16px",borderRadius:14,background:"rgba(255,167,38,.08)",border:"1px solid rgba(255,167,38,.18)",color:"#ffcc80",fontSize:12,marginBottom:18,lineHeight:1.6}}>
        {t("serversTab")}：{t("serversDevNotice")}
      </div>
      {candidates.length>0&&(
        <div className="neon-panel neon-panel-blue" style={{background:"rgba(255,255,255,.02)",borderRadius:18,padding:"18px",marginBottom:18,border:"1px solid rgba(255,255,255,.05)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:14}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:"#eceff1"}}>{t("chooseBmUser")}</div>
              <div style={{fontSize:11,color:"#78909c",marginTop:4}}>{t("chooseBmHint")}</div>
            </div>
            {data&&(
              <button className="neon-button" onClick={onResetSelection} style={{padding:"8px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.03)",color:"#b0bec5",fontSize:12,cursor:"pointer"}}>
                {t("reselect")}
              </button>
            )}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {candidates.map((candidate)=>(
              <button
                className={`neon-button neon-option-button ${selectedBmId===candidate.bmId?"active":""}`}
                key={candidate.bmId}
                onClick={()=>onSelectBm(candidate.bmId)}
                style={{
                  textAlign:"left",
                  padding:"12px 14px",
                  borderRadius:12,
                  border:selectedBmId===candidate.bmId?"1px solid rgba(66,165,245,.35)":"1px solid rgba(255,255,255,.05)",
                  background:selectedBmId===candidate.bmId?"rgba(33,150,243,.08)":"rgba(255,255,255,.02)",
                  color:"#e0e0e0",
                  cursor:"pointer",
                }}
              >
                <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                  <div style={{minWidth:200,flex:"1 1 260px"}}>
                    <div style={{fontSize:13,fontWeight:700,overflowWrap:"anywhere"}}>{candidate.name||"Unknown"}</div>
                    <div style={{fontSize:11,color:"#546e7a",fontFamily:"'JetBrains Mono',monospace"}}>{candidate.bmId}</div>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>{t("candidateScore")} {candidate.score ?? 0}</span>
                    <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>{t("sessionPreview")} {candidate.sessionPreview?.count ?? 0}</span>
                    <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>{candidate.lastSeen?`${t("recentSeen")} ${timeAgo(candidate.lastSeen, lang)}`:t("noRecentSeen")}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:14}}>
            <div style={{fontSize:11,color:"#78909c"}}>
              {selectedCandidate?`${t("selectedNow")}：${selectedCandidate.name} (${selectedCandidate.bmId})`:t("selectOneFirst")}
            </div>
            <button
              className={`neon-button neon-button-primary ${(!selectedBmId||loading)?"disabled":""}`}
              onClick={onLoadSelected}
              disabled={!selectedBmId||loading}
              style={{
                padding:"10px 16px",
                borderRadius:10,
                border:"none",
                background:(!selectedBmId||loading)?"rgba(33,150,243,.18)":"linear-gradient(135deg,#1e88e5,#42a5f5)",
                color:"#fff",
                cursor:(!selectedBmId||loading)?"not-allowed":"pointer",
                fontSize:12,
                fontWeight:700,
              }}
            >
              {loading?`⏳ ${t("loading")}`:t("loadSelectedServer")}
            </button>
          </div>
        </div>
      )}

      {loading&&(
        <div className="neon-card" style={{padding:"14px 16px",borderRadius:14,background:"rgba(33,150,243,.08)",border:"1px solid rgba(33,150,243,.16)",color:"#90caf9",fontSize:12,marginBottom:18}}>
          {t("loadingSelectedServer")}
        </div>
      )}
      {!data ? null : (
      <>
      <div className="neon-panel neon-panel-blue" style={{background:"linear-gradient(135deg,rgba(33,150,243,.08),rgba(30,30,50,.4))",borderRadius:18,padding:"24px 28px",marginBottom:20,border:"1px solid rgba(33,150,243,.12)"}}>
        <div style={{fontSize:11,color:"#78909c",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>{t("totalPlaytime")}</div>
        <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:"clamp(30px,4vw,46px)",fontWeight:900,color:"#42a5f5",fontFamily:"'JetBrains Mono',monospace"}}>{fmtServerDuration(sm.totalHours, lang, locale)}</span>
          <span style={{fontSize:13,color:"#455a64",marginLeft:8}}>{sm.totalHours >= 24 ? replaceVars(t("approxDays"), { value: fmtFull(sm.totalDays, locale) }) : replaceVars(t("totalSessions"), { value: fmtFull(sm.totalSessions, locale) })}</span>
        </div>
        <div style={{display:"flex",gap:16,marginTop:10,fontSize:12,color:"#546e7a",flexWrap:"wrap"}}>
          <span>🖥️ {fmtFull(sm.serverCount, locale)} {t("servers")}</span><span>📋 {fmtFull(sm.totalSessions, locale)} {t("sessions")}</span>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {data.servers.map((srv,i)=>{
          const pct=(srv.totalHours/maxH)*100;const on=srv.status==="online";
          return (
            <div key={i} className="neon-card neon-row neon-card-interactive" style={{background:"rgba(255,255,255,.02)",borderRadius:12,padding:"14px 16px",border:"1px solid rgba(255,255,255,.04)",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:`${pct}%`,background:"rgba(33,150,243,.05)"}}/>
              <div style={{position:"relative",zIndex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:10,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,flex:"1 1 300px"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:on?"#66bb6a":"#ef5350",boxShadow:on?"0 0 6px rgba(102,187,106,.5)":"none"}}/>
                    <span style={{fontSize:13,fontWeight:600,color:"#e0e0e0",overflowWrap:"anywhere"}}>{srv.name}</span>
                  </div>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:on?"rgba(102,187,106,.08)":"rgba(239,83,80,.08)",color:on?"#66bb6a":"#ef5350"}}>{on?replaceVars(t("onlinePlayers"), { value: srv.players }):t("offlineShort")}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:12,fontSize:11,color:"#546e7a",flexWrap:"wrap"}}><span>🌐 {srv.country}</span><span>📋 {fmtFull(srv.sessionCount, locale)} {t("timesShort")}</span><span>🕐 {timeAgo(srv.lastSeen, lang)}</span></div>
                  <div style={{fontSize:17,fontWeight:800,color:"#42a5f5",fontFamily:"'JetBrains Mono',monospace"}}>{fmtServerDuration(srv.totalHours, lang, locale)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
}

// ═══════════════════════════
//  Main App
// ═══════════════════════════
export default function App() {
  const [lang,setLang]=useState(detectInitialLang);
  const [currency,setCurrency]=useState(()=>detectInitialCurrency(detectInitialLang()));
  const [currencyManual,setCurrencyManual]=useState(detectCurrencyManual);
  const [usdToCny,setUsdToCny]=useState(null);
  const [rateMeta,setRateMeta]=useState(null);
  const [tab,setTab]=useState("kda");
  const [steamId,setSteamId]=useState("");
  const [loading,setLoading]=useState(false);
  const [player,setPlayer]=useState(null);
  const [kda,setKda]=useState(null);
  const [inv,setInv]=useState(null);
  const [srv,setSrv]=useState(null);
  const [serverCandidates,setServerCandidates]=useState(null);
  const [selectedBmId,setSelectedBmId]=useState("");
  const [serverLoading,setServerLoading]=useState(false);
  const [serverError,setServerError]=useState("");
  const [demo,setDemo]=useState(false);
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  const t = useCallback((key) => UI[lang]?.[key] || UI.zh[key] || key, [lang]);
  const formatMoneyValue = useCallback((value) => {
    const converted = convertMoney(value, currency, usdToCny);
    return fmtMoney(converted, locale, currency);
  }, [currency, locale, usdToCny]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("rust-kda-language", lang);
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    }
  }, [lang]);

  useEffect(() => {
    if (!currencyManual) {
      setCurrency(defaultCurrencyForLang(lang));
    }
  }, [lang, currencyManual]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currencyManual) {
      window.localStorage.setItem("rust-kda-currency", currency);
      window.localStorage.setItem("rust-kda-currency-manual", "1");
    } else {
      window.localStorage.removeItem("rust-kda-currency");
      window.localStorage.removeItem("rust-kda-currency-manual");
    }
  }, [currency, currencyManual]);

  useEffect(() => {
    let cancelled = false;
    if (currency !== "CNY") {
      setUsdToCny(1);
      return;
    }

    const cacheKey = "rust-kda-usd-cny-rate";
    const now = Date.now();
    const applyRate = (payload, stale = false) => {
      if (cancelled || !payload?.rate) return;
      setUsdToCny(payload.rate);
      setRateMeta({
        provider: payload.provider,
        documentation: payload.documentation,
        nextUpdateUnix: payload.nextUpdateUnix,
        stale,
      });
    };

    try {
      const cached = typeof window !== "undefined" ? JSON.parse(window.localStorage.getItem(cacheKey) || "null") : null;
      if (cached?.rate && cached?.nextUpdateUnix && now < cached.nextUpdateUnix * 1000) {
        applyRate(cached);
        return () => { cancelled = true; };
      }
      if (cached?.rate) {
        applyRate(cached, true);
      }
    } catch {}

    fetch("https://open.er-api.com/v6/latest/USD")
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled || payload?.result !== "success" || typeof payload?.rates?.CNY !== "number") return;
        const nextUpdateUnix = payload.time_next_update_unix || 0;
        const cachedPayload = {
          rate: payload.rates.CNY,
          provider: payload.provider || "https://www.exchangerate-api.com",
          documentation: payload.documentation || "https://www.exchangerate-api.com/docs/free",
          nextUpdateUnix,
        };
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(cacheKey, JSON.stringify(cachedPayload));
          }
        } catch {}
        applyRate(cachedPayload);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currency]);

  const apiJson = useCallback(async (path, options = {}) => {
    const headers = {...(options.headers||{})};
    const hasBody = options.body != null;
    if(hasBody && !headers["Content-Type"]){
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
    const payload = await response.json().catch(()=>({}));
    if(!response.ok || payload?.error){
      throw new Error(payload?.error || t("requestFailed"));
    }
    return payload;
  }, [t]);

  const loadServersForSelection = useCallback(async (inputId, bmId)=>{
    if(!inputId || !bmId) return;
    startTransition(()=>{
      setServerLoading(true);
      setServerError("");
      setSrv(null);
      setTab("servers");
    });
    try{
      const payload = await apiJson(`/servers/${encodeURIComponent(inputId)}?bmId=${encodeURIComponent(bmId)}`);
      startTransition(()=>setSrv(payload));
    }catch(err){
      startTransition(()=>setServerError(err?.message || t("serverLoadFailed")));
    }
    startTransition(()=>setServerLoading(false));
  },[apiJson, t]);

  const query=useCallback(async()=>{
    if(!steamId.trim()) return;
    startTransition(()=>{
      setLoading(true);setPlayer(null);setKda(null);setInv(null);setSrv(null);setServerCandidates(null);setSelectedBmId("");setServerLoading(false);setServerError("");setDemo(false);
    });
    try {
      const p=await apiJson(`/player/${steamId}`);
      const [k,i,c]=await Promise.allSettled([
        apiJson(`/kda/${steamId}`),
        apiJson(`/inventory/${steamId}`),
        apiJson(`/servers/candidates/${encodeURIComponent(steamId)}`),
      ]);
      startTransition(()=>{
        setPlayer(p);
        if(k.status==="fulfilled") setKda(k.value);
        if(i.status==="fulfilled") setInv(i.value);
        if(c.status==="fulfilled" && !c.value?.error){
          setServerCandidates(c.value);
          if(c.value?.candidates?.length){
            setSelectedBmId(c.value.candidates[0].bmId);
          }else{
            setServerError(t("noBmFound"));
          }
        }else{
          setServerError(t("bmSearchFailed"));
        }
      });
    } catch (err) {
      startTransition(()=>{
        setDemo(true);
        setPlayer({steamId,name:"Demo_Player",status:"演示模式",country:"CN",created:1609459200,lastLogoff:1712102400,playtimeHours:2890.4,playtimeTwoWeeksHours:36.5,achievementsCount:67});
        setKda(DEMO.kda); setInv(DEMO.inventory); setSrv(DEMO.servers); setServerCandidates({steamId,playerName:"Demo_Player",candidates:[{bmId:"demo-1",name:"Demo_Player",score:100,sessionPreview:{count:4,hasMore:false},lastSeen:new Date().toISOString()}]}); setSelectedBmId("demo-1");
      });
    }
    startTransition(()=>setLoading(false));
  },[apiJson, steamId, t]);

  const tabs=[
    {id:"kda",label:t("kdaTab"),icon:"⚔️",color:"#00e5ff"},
    {id:"inventory",label:t("inventoryTab"),icon:"💰",color:"#b388ff"},
    {id:"servers",label:t("serversTab"),icon:"🖥️",color:"#4dd0e1"},
  ];
  const isActiveStatus = ["在线", "游戏中", "Online", "In Game"].includes(player?.status);
  const rateText = currency === "CNY" && typeof usdToCny === "number"
    ? `1 USD ≈ ${fmtMoney(usdToCny, locale, "CNY")}`
    : "1 USD";

  return (
    <div className="site-shell" style={{minHeight:"100vh",background:"transparent",fontFamily:"'Noto Sans SC','Inter',-apple-system,sans-serif",color:"#e0e0e0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes particleDriftSlow{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,-120px,0)}}
        @keyframes particleDriftFast{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,-180px,0)}}
        @keyframes neonSweep{0%{transform:translateX(-170%) rotate(12deg)}100%{transform:translateX(760%) rotate(12deg)}}
        *{box-sizing:border-box;margin:0;padding:0}
        :root{
          --bg-0:#050214;
          --bg-1:#0c0720;
          --bg-2:#120a2e;
          --panel:#09061acc;
          --panel-strong:#0d0824f2;
          --panel-soft:#ffffff08;
          --border:rgba(0,229,255,.12);
          --border-strong:rgba(179,136,255,.24);
          --text-0:#f2f7ff;
          --text-1:#c8d1ea;
          --text-2:#8f96b8;
          --accent:#00e5ff;
          --accent-2:#b388ff;
          --accent-3:#6ef7ff;
          --shadow-lg:0 24px 60px rgba(0,0,0,.42);
          --shadow-md:0 14px 30px rgba(0,0,0,.28);
          --radius-xl:22px;
          --radius-lg:18px;
          --radius-md:14px;
        }
        ::-webkit-scrollbar{width:8px}
        ::-webkit-scrollbar-thumb{background:rgba(0,229,255,.16);border-radius:999px}
        input::placeholder{color:#7881a8}
        body{
          position:relative;
          background:#030014;
          color:var(--text-0);
        }
        .site-shell{
          position:relative;
          isolation:isolate;
          overflow:hidden;
        }
        .particle-bg{
          position:fixed;
          inset:0;
          pointer-events:none;
          z-index:0;
          overflow:hidden;
        }
        .particle-layer{
          position:absolute;
          inset:-20vh 0;
          background-image:radial-gradient(circle, rgba(255,255,255,.9) 1px, transparent 1.4px);
          background-repeat:repeat;
          mix-blend-mode:screen;
          will-change:transform;
        }
        .particle-layer-one{
          background-size:72px 72px;
          background-position:0 0;
          opacity:.3;
          animation:particleDriftSlow 32s linear infinite;
        }
        .particle-layer-two{
          background-size:118px 132px;
          background-position:28px 34px;
          opacity:.18;
          filter:blur(.4px);
          animation:particleDriftFast 22s linear infinite;
        }
        .site-shell::before{
          content:"";
          position:absolute;
          inset:0;
          pointer-events:none;
          background:
            linear-gradient(180deg, rgba(255,255,255,.02), transparent 18%);
          z-index:0;
        }
        .site-shell::after{
          content:"";
          position:absolute;
          left:50%;
          bottom:-8rem;
          width:min(92rem,124vw);
          height:30rem;
          transform:translateX(-50%);
          pointer-events:none;
          background:
            radial-gradient(ellipse at 50% 42%, rgba(0,229,255,.12), rgba(0,229,255,.06) 26%, rgba(53,0,104,.28) 56%, transparent 76%),
            linear-gradient(180deg, rgba(3,0,20,0), rgba(8,5,30,.24) 72%, rgba(3,0,20,.7));
          filter:blur(16px);
          opacity:.42;
          z-index:0;
        }
        .app-shell{position:relative;z-index:1;width:min(100%,1720px);margin:0 auto;padding:0 clamp(14px,2.4vw,30px) 34px}
        .header-shell{padding:22px clamp(14px,2.4vw,30px) 12px}
        .header-panel{
          position:relative;
          overflow:hidden;
          border-radius:26px;
          border:1px solid rgba(0,229,255,.18);
          background:
            linear-gradient(180deg, rgba(8,5,25,.74), rgba(4,2,15,.84)) padding-box,
            linear-gradient(135deg, rgba(0,229,255,.22), rgba(179,136,255,.12)) border-box;
          box-shadow:
            0 18px 50px rgba(0,0,0,.55),
            0 0 0 1px rgba(0,229,255,.08),
            inset 0 1px 0 rgba(255,255,255,.05);
          padding:20px;
        }
        .header-panel::before{
          content:"";
          position:absolute;
          inset:0;
          pointer-events:none;
          background:
            radial-gradient(circle at 18% 18%, rgba(0,229,255,.14), transparent 24%),
            radial-gradient(circle at 82% 22%, rgba(124,77,255,.18), transparent 28%),
            linear-gradient(180deg, rgba(255,255,255,.02), transparent 40%);
        }
        .header-top{
          position:relative;
          z-index:1;
          display:flex;
          align-items:center;
          gap:12px;
          margin-bottom:16px;
          flex-wrap:wrap;
        }
        .brand-badge{
          width:42px;
          height:42px;
          border-radius:14px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:18px;
          font-weight:900;
          color:#fff;
          font-family:"JetBrains Mono", monospace;
          background:
            linear-gradient(135deg, rgba(0,229,255,.2), rgba(179,136,255,.36));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.18),
            0 16px 28px rgba(6,10,18,.36),
            0 0 0 1px rgba(0,229,255,.18),
            0 0 24px rgba(0,229,255,.2);
        }
        .brand-meta{
          flex:1;
          min-width:240px;
        }
        .brand-title{
          font-size:18px;
          font-weight:800;
          letter-spacing:-.4px;
          color:var(--text-0);
        }
        .brand-subtitle{
          margin-top:4px;
          font-size:10px;
          letter-spacing:1.6px;
          text-transform:uppercase;
          color:#7a85ad;
        }
        .search-shell{display:flex;gap:10px;flex-wrap:wrap}
        .search-shell input{min-width:240px}
        .tab-shell{
          display:flex;
          gap:10px;
          padding:0 clamp(14px,2.4vw,30px) 14px;
          flex-wrap:wrap;
          align-items:center;
        }
        .content-shell{padding-top:20px}
        .player-shell{
          display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px;padding:16px 18px;
          background:
            linear-gradient(180deg, rgba(8,5,25,.66), rgba(4,2,15,.78)) padding-box,
            linear-gradient(118deg, rgba(0,229,255,.08), rgba(124,77,255,.16), rgba(0,229,255,.12)) border-box;
          border-radius:var(--radius-lg);
          border:1px solid transparent;
        }
        .neon-panel,.neon-card,.player-shell,.lang-switch,.neon-chip{
          position:relative;
          overflow:hidden;
          backdrop-filter:blur(14px);
          box-shadow:var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,.04);
        }
        .neon-panel::after,.neon-card::after,.player-shell::after{
          content:"";
          position:absolute;
          inset:-1px;
          border-radius:inherit;
          padding:1px;
          background:
            linear-gradient(118deg, rgba(255,255,255,.18) 0%, rgba(0,229,255,.34) 14%, rgba(0,229,255,.95) 22%, rgba(255,255,255,.16) 34%, rgba(179,136,255,.62) 48%, rgba(255,255,255,.1) 60%, rgba(0,229,255,.9) 76%, rgba(124,77,255,.26) 100%);
          background-size:300% 300%;
          -webkit-mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite:xor;
          mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite:exclude;
          filter:drop-shadow(0 0 10px rgba(0,229,255,.16)) drop-shadow(0 0 18px rgba(124,77,255,.12));
          pointer-events:none;
          opacity:.3;
        }
        .neon-panel > *,.neon-card > *,.player-shell > *,.lang-switch > *{position:relative;z-index:1}
        .neon-panel{
          background:
            linear-gradient(180deg, rgba(8,5,25,.62), rgba(4,2,15,.78)) padding-box,
            linear-gradient(118deg, rgba(0,229,255,.08), rgba(124,77,255,.16), rgba(0,229,255,.12)) border-box;
          border-radius:var(--radius-xl);
          border:1px solid transparent;
        }
        .neon-panel-ember{box-shadow:var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,.04), 0 0 0 1px rgba(0,229,255,.08)}
        .neon-panel-gold{box-shadow:var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,.04), 0 0 0 1px rgba(179,136,255,.08)}
        .neon-panel-blue{box-shadow:var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,.04), 0 0 0 1px rgba(0,229,255,.08)}
        .neon-panel-accent{box-shadow:var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,.04), 0 0 0 1px rgba(124,77,255,.12)}
        .neon-card-interactive,.neon-row,.neon-button{transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease, color .18s ease}
        .neon-card-interactive:hover,.neon-row:hover{
          transform:translateY(-2px);
          box-shadow:
            0 20px 46px rgba(0,0,0,.34),
            inset 0 1px 0 rgba(255,255,255,.05),
            0 0 0 1px rgba(0,229,255,.12),
            0 0 24px rgba(0,229,255,.08);
        }
        .neon-chip{
          box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 8px 18px rgba(0,0,0,.18);
        }
        .neon-input{
          background:
            linear-gradient(180deg, rgba(10,8,30,.78), rgba(5,5,20,.88)) padding-box,
            linear-gradient(120deg, rgba(0,229,255,.18), rgba(179,136,255,.12)) border-box !important;
          border:1px solid transparent !important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.04), 0 12px 24px rgba(0,0,0,.22);
          transition:box-shadow .2s ease, transform .2s ease;
        }
        .neon-input:focus{
          box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 16px 30px rgba(0,0,0,.24), 0 0 0 1px rgba(0,229,255,.28), 0 0 18px rgba(0,229,255,.12);
          transform:translateY(-1px);
        }
        .lang-switch{
          display:flex;align-items:center;gap:6px;padding:6px;border-radius:999px;
          background:rgba(5,5,20,.78);border:1px solid rgba(0,229,255,.18);
          box-shadow:var(--shadow-md), inset 0 1px 0 rgba(255,255,255,.04);
        }
        .toolbar-group{
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
          justify-content:flex-end;
        }
        .toolbar-meta{
          display:flex;
          flex-direction:column;
          align-items:flex-end;
          gap:4px;
        }
        .toolbar-note{
          font-size:10px;
          color:#7c89ab;
          display:flex;
          gap:8px;
          align-items:center;
          flex-wrap:wrap;
          justify-content:flex-end;
        }
        .toolbar-note a{
          color:#8ecfff;
          text-decoration:none;
        }
        .lang-switch button{padding:7px 13px;border:none;border-radius:999px;background:transparent;color:#97a4c7;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s}
        .lang-switch button.active{
          background:linear-gradient(180deg, rgba(0,229,255,.18), rgba(179,136,255,.14));
          color:#f7fbff;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.12), 0 8px 18px rgba(0,0,0,.18), 0 0 12px rgba(0,229,255,.16);
        }
        .neon-button{
          position:relative;
          overflow:hidden;
          isolation:isolate;
          background:
            linear-gradient(180deg, rgba(10,8,30,.78), rgba(5,5,20,.88)) padding-box,
            linear-gradient(120deg, rgba(0,229,255,.18), rgba(179,136,255,.08)) border-box !important;
          border:1px solid transparent !important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 10px 20px rgba(0,0,0,.22);
        }
        .neon-button::before{
          content:"";
          position:absolute;
          inset:-30% auto -30% -46%;
          width:18%;
          background:linear-gradient(115deg, transparent 20%, rgba(255,255,255,.12) 50%, transparent 78%);
          transform:translateX(-170%) rotate(12deg);
          pointer-events:none;
          opacity:0;
          filter:blur(1px);
        }
        .neon-button:hover:not(.disabled)::before{
          opacity:.24;
          animation:neonSweep 1.1s ease forwards;
        }
        .neon-button:hover:not(.disabled){
          transform:translateY(-2px);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 14px 24px rgba(0,0,0,.22), 0 0 0 1px rgba(0,229,255,.12), 0 0 18px rgba(0,229,255,.08);
        }
        .neon-button.active{
          background:
            linear-gradient(180deg, rgba(16,11,41,.98), rgba(8,5,25,.98)) padding-box,
            linear-gradient(120deg, rgba(0,229,255,.36), rgba(179,136,255,.24)) border-box !important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.09), 0 14px 24px rgba(0,0,0,.20), 0 0 0 1px rgba(0,229,255,.18), 0 0 22px rgba(0,229,255,.08);
        }
        .neon-button-primary{
          background:
            linear-gradient(135deg, rgba(0,229,255,.92), rgba(124,77,255,.88)) padding-box,
            linear-gradient(120deg, rgba(255,255,255,.28), rgba(255,255,255,.08)) border-box !important;
          color:#fff !important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.18), 0 16px 28px rgba(19,10,72,.28), 0 0 22px rgba(0,229,255,.14);
        }
        .neon-button-primary:hover:not(.disabled){
          box-shadow:inset 0 1px 0 rgba(255,255,255,.18), 0 18px 32px rgba(19,10,72,.32), 0 0 26px rgba(0,229,255,.18);
        }
        .neon-filter-button{
          background:
            linear-gradient(180deg, rgba(9,8,26,.86), rgba(5,5,20,.9)) padding-box,
            linear-gradient(120deg, rgba(0,229,255,.12), rgba(179,136,255,.08)) border-box !important;
          color:#97a6c8 !important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 8px 14px rgba(0,0,0,.14);
        }
        .neon-filter-button.active{
          color:#f7fbff !important;
        }
        .neon-tab{
          border-radius:14px !important;
          min-width:auto;
          justify-content:center;
          gap:6px !important;
          padding:10px 14px !important;
          background:
            linear-gradient(180deg, rgba(10,8,30,.94), rgba(5,5,20,.98)) padding-box,
            linear-gradient(120deg, rgba(0,229,255,.16), rgba(179,136,255,.10)) border-box !important;
          color:#a9b5d4 !important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 8px 16px rgba(0,0,0,.14);
        }
        .neon-tab.active{
          color:#f4f8ff !important;
          background:
            linear-gradient(180deg, rgba(16,11,41,.98), rgba(8,5,25,.98)) padding-box,
            linear-gradient(120deg, rgba(0,229,255,.36), rgba(179,136,255,.24)) border-box !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.08),
            0 14px 24px rgba(0,0,0,.18),
            0 0 0 1px rgba(0,229,255,.18),
            0 0 18px rgba(0,229,255,.08);
        }
        .neon-option-button{
          width:100%;
          border-radius:14px !important;
          text-align:left;
        }
        .neon-option-button.active{
          box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 12px 22px rgba(0,0,0,.18), 0 0 0 1px rgba(0,229,255,.16), 0 0 18px rgba(0,229,255,.08);
        }
        @media (max-width: 900px){
          .header-shell{padding-top:16px}
          .tab-shell{padding-bottom:8px}
        }
        @media (max-width: 640px){
          .search-shell input{min-width:0;width:100%}
          .header-panel{padding:16px}
        }
      `}</style>

      <div className="particle-bg" aria-hidden="true">
        <div className="particle-layer particle-layer-one" />
        <div className="particle-layer particle-layer-two" />
      </div>

      {/* Header */}
      <div style={{position:"relative",zIndex:1,background:"linear-gradient(180deg,rgba(0,229,255,.04) 0%,transparent 100%)",borderBottom:"1px solid rgba(255,255,255,.03)"}} className="header-shell">
        <div className="header-panel">
          <div className="header-top">
            <div className="brand-badge">R</div>
            <div className="brand-meta">
              <div className="brand-title">{t("appTitle")}</div>
              <div className="brand-subtitle">{t("appSubtitle")}</div>
            </div>
            <div className="toolbar-meta">
              <div className="toolbar-group">
                <div className="lang-switch" aria-label={t("language")}>
                  <button className={lang==="zh"?"active":""} onClick={()=>setLang("zh")}>{t("chinese")}</button>
                  <button className={lang==="en"?"active":""} onClick={()=>setLang("en")}>{t("english")}</button>
                </div>
                <div className="lang-switch" aria-label={t("currency")}>
                  <button className={currency==="CNY"?"active":""} onClick={()=>{setCurrency("CNY");setCurrencyManual(true);}}>{t("rmbLabel")}</button>
                  <button className={currency==="USD"?"active":""} onClick={()=>{setCurrency("USD");setCurrencyManual(true);}}>{t("usdLabel")}</button>
                </div>
              </div>
              <div className="toolbar-note">
                <span>{t("exchangeRate")} · {rateText}</span>
                {rateMeta?.documentation && (
                  <a href={rateMeta.documentation} target="_blank" rel="noreferrer">
                    {t("rateAttribution")} ExchangeRate-API
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="search-shell" style={{position:"relative",zIndex:1}}>
            <input className="neon-input" value={steamId} onChange={e=>setSteamId(e.target.value)} onKeyDown={e=>e.key==="Enter"&&query()}
              placeholder={t("queryPlaceholder")}
              style={{flex:1,padding:"11px 14px",borderRadius:12,background:"rgba(255,255,255,.035)",border:"1px solid rgba(255,255,255,.06)",color:"#e0e0e0",fontSize:13,outline:"none",fontFamily:"'JetBrains Mono',monospace"}}
            />
            <button className={`neon-button neon-button-primary ${loading?"disabled":""}`} onClick={query} disabled={loading} style={{padding:"10px 22px",borderRadius:12,border:"none",background:loading?"rgba(0,229,255,.18)":"linear-gradient(135deg,#00e5ff,#7c4dff)",color:"#fff",fontSize:13,fontWeight:700,cursor:loading?"wait":"pointer",boxShadow:loading?"none":"0 4px 18px rgba(0,229,255,.22)",whiteSpace:"nowrap"}}>
              {loading?"⏳":"🔍"} {t("queryButton")}
            </button>
          </div>
          {demo&&<div style={{position:"relative",zIndex:1,marginTop:10,padding:"6px 12px",borderRadius:10,background:"rgba(255,167,38,.08)",border:"1px solid rgba(255,167,38,.15)",fontSize:11,color:"#ffa726",textAlign:"center"}}>{t("demoNotice")}</div>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{position:"relative",zIndex:1,borderBottom:"1px solid rgba(255,255,255,.03)",background:"rgba(0,0,0,.15)"}} className="tab-shell">
        {tabs.map(t=>(
          <button className={`neon-button neon-tab ${tab===t.id?"active":""}`} key={t.id} onClick={()=>setTab(t.id)} style={{border:"none",background:tab===t.id?`${t.color}0d`:"transparent",color:tab===t.id?t.color:"#455a64",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",transition:"all .2s"}}>
            <span style={{fontSize:13}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="app-shell">
      <div className="content-shell">
        {loading?(
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{display:"inline-block",animation:"spin 1s linear infinite"}}><svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="rgba(0,229,255,.24)" strokeWidth="3"/><circle cx="16" cy="16" r="12" fill="none" stroke="#00e5ff" strokeWidth="3" strokeDasharray="40 36" strokeLinecap="round"/></svg></div>
            <div style={{fontSize:13,color:"#546e7a",marginTop:12,animation:"pulse 1.5s infinite"}}>{t("querying")}</div>
          </div>
        ):!player?(
          <div style={{textAlign:"center",padding:"60px 20px",color:"#263238"}}>
            <div style={{fontSize:52,marginBottom:14,opacity:.2}}>🎮</div>
            <div style={{fontSize:14,color:"#37474f"}}>{t("emptyTitle")}</div>
            <div style={{fontSize:11,color:"#1a1a1a",marginTop:6}}>{t("emptyHint")}</div>
          </div>
        ):(
          <>
            <div className="player-shell">
              {player.avatarMedium?<img src={player.avatarMedium} alt="" style={{width:48,height:48,borderRadius:12,border:"2px solid rgba(255,255,255,.08)"}}/>:<div style={{width:48,height:48,borderRadius:12,background:"linear-gradient(135deg,#00e5ff,#7c4dff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#fff"}}>{player.name?.[0]?.toUpperCase()||"?"}</div>}
              <div style={{flex:1,minWidth:220}}><div style={{fontSize:16,fontWeight:700,overflowWrap:"anywhere"}}>{player.name}</div><div style={{fontSize:11,color:"#455a64",fontFamily:"'JetBrains Mono',monospace",overflowWrap:"anywhere"}}>{player.steamId||steamId}</div></div>
              <div style={{padding:"4px 10px",borderRadius:8,background:isActiveStatus?"rgba(102,187,106,.08)":"rgba(120,144,156,.08)",fontSize:11,fontWeight:600,color:isActiveStatus?"#66bb6a":"#78909c"}}>{translateStatus(lang, player.status)}</div>
            </div>
            {tab==="kda"&&kda&&<KDAPanel data={kda} player={player} inventory={inv} servers={srv} lang={lang} locale={locale} t={t} formatMoneyValue={formatMoneyValue}/>}
            {tab==="inventory"&&inv&&<InventoryPanel data={inv} lang={lang} locale={locale} t={t} formatMoneyValue={formatMoneyValue}/>}
            {tab==="servers"&&(
              <ServerPanel
                data={srv}
                candidatesPayload={serverCandidates}
                selectedBmId={selectedBmId}
                onSelectBm={setSelectedBmId}
                onLoadSelected={()=> demo ? setSrv(DEMO.servers) : loadServersForSelection(steamId, selectedBmId)}
                onResetSelection={()=>{
                  setSrv(null);
                  setServerError("");
                }}
                loading={serverLoading}
                error={serverError || srv?.error}
                lang={lang}
                locale={locale}
                t={t}
              />
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
