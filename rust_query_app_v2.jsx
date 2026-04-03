import { startTransition, useCallback, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const fmt = (n) => { if (n >= 1e6) return (n/1e6).toFixed(1)+"M"; if (n >= 1e3) return (n/1e3).toFixed(1)+"K"; return (n||0).toLocaleString(); };
const timeAgo = (s) => { if(!s) return "—"; const h=(Date.now()-new Date(s).getTime())/36e5; if(h<1) return "刚刚"; if(h<24) return `${Math.floor(h)}小时前`; const d=h/24; return d<30?`${Math.floor(d)}天前`:`${Math.floor(d/30)}个月前`; };
const fmtMetric = (v) => typeof v === "number" ? (Number.isInteger(v) ? fmt(v) : v.toLocaleString(undefined,{maximumFractionDigits:1})) : (v ?? "—");
const fmtFull = (v) => typeof v === "number" ? v.toLocaleString(undefined,{maximumFractionDigits:Number.isInteger(v)?0:1}) : (v ?? "—");
const fmtHours = (v) => v==null ? "—" : `${v.toLocaleString(undefined,{maximumFractionDigits:1})}h`;
const fmtServerDuration = (v) => {
  if (v == null) return "—";
  if (v > 0 && v < 1) return `${Math.max(1, Math.round(v * 60))}分钟`;
  return `${v.toLocaleString(undefined,{maximumFractionDigits:1})}小时`;
};
const fmtDate = (ts) => !ts ? "—" : new Date(typeof ts==="number"?ts*1000:ts).toLocaleDateString("zh-CN");
const fmtMoney = (v) => v==null ? "—" : `$${v.toFixed(2)}`;
const fmtPercent = (v) => v==null ? "—" : `${v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
const fmtDateTime = (ts) => !ts ? "—" : new Date(typeof ts==="number"?ts*1000:ts).toLocaleString("zh-CN",{hour12:false});
const yearsSince = (ts) => {
  if(!ts) return "—";
  const now = new Date();
  const then = new Date(typeof ts==="number"?ts*1000:ts);
  const years = (now - then) / (365.25 * 24 * 60 * 60 * 1000);
  return `${years.toFixed(1)}年`;
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
      {id:"resources",title:"采集",emoji:"⛏️",color:"#26a69a",items:[{id:"metalOre",label:"金属矿石",value:189400,icon:"🪨"},{id:"stone",label:"石头",value:876200,icon:"🧱"},{id:"wood",label:"木头",value:1542300,icon:"🪵"},{id:"scrap",label:"废料",value:18340,icon:"🧲"},{id:"lowGradeFuel",label:"低级燃料",value:7520,icon:"🛢️"},{id:"cloth",label:"布",value:234500,icon:"🧶"},{id:"leather",label:"皮革",value:98320,icon:"🧥"},{id:"sulfurOre",label:"硫磺矿石",value:84210,icon:"💛"},{id:"boneFragments",label:"骨片",value:6410,icon:"🦴"},{id:"animalFat",label:"动物脂肪",value:7850,icon:"🥩"}]},
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
function StatCard({icon,label,value,color,sub}) {
  const [h,setH]=useState(false);
  return (
    <div onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{background:h?`${color}0d`:"rgba(255,255,255,.025)",borderRadius:14,padding:"16px 14px",textAlign:"center",border:`1px solid ${h?color+"44":"rgba(255,255,255,.04)"}`,transition:"all .25s",cursor:"default",position:"relative",overflow:"hidden",minHeight:118}}>
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
  return (<div style={{background:"rgba(255,255,255,.02)",borderRadius:10,padding:"12px 10px",border:"1px solid rgba(255,255,255,.04)",textAlign:"center",minHeight:84}}><div style={{fontSize:16,marginBottom:4}}>{icon}</div><div style={{fontSize:"clamp(14px,1.6vw,18px)",fontWeight:700,color:"#b0bec5",fontFamily:"'JetBrains Mono',monospace",lineHeight:1.2}}>{value}</div><div style={{fontSize:10,color:"#546e7a",marginTop:6,lineHeight:1.35}}>{label}</div></div>);
}
function SectionTitle({emoji,title}) {
  return <div style={{fontSize:13,fontWeight:600,color:"#90a4ae",marginBottom:10,letterSpacing:1,display:"flex",alignItems:"center",gap:6}}><span>{emoji}</span>{title}</div>;
}
function ErrorBox({msg}) {
  return <div style={{padding:"20px 24px",borderRadius:14,background:"rgba(239,83,80,.06)",border:"1px solid rgba(239,83,80,.15)",color:"#ef9a9a",fontSize:13,textAlign:"center"}}><div style={{fontSize:28,marginBottom:8}}>⚠️</div>{msg}</div>;
}

function SectionMetric({item,accent,formatValue=fmtMetric}) {
  return (
    <div style={{padding:"12px 12px 10px",borderRadius:12,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)",minHeight:88}}>
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
    <div style={{background:"rgba(255,255,255,.02)",borderRadius:18,padding:"18px 18px 16px",border:"1px solid rgba(255,255,255,.05)"}}>
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

function KdaProfileCard({player,inventory,servers,summary}) {
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
    <div style={{background:"linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015))",borderRadius:18,padding:"20px",border:"1px solid rgba(255,255,255,.05)",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        {player?.avatarMedium?<img src={player.avatarMedium} alt="" style={{width:62,height:62,borderRadius:16,border:"2px solid rgba(255,255,255,.08)"}}/>:<div style={{width:62,height:62,borderRadius:16,background:"linear-gradient(135deg,#cd412b,#e65100)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:800,color:"#fff"}}>{player?.name?.[0]?.toUpperCase()||"?"}</div>}
        <div style={{minWidth:0}}>
          <div style={{fontSize:"clamp(17px,2vw,21px)",fontWeight:800,color:"#eceff1",overflowWrap:"anywhere"}}>{player?.name||"玩家画像"}</div>
          <div style={{fontSize:11,color:"#546e7a",fontFamily:"'JetBrains Mono',monospace",overflowWrap:"anywhere"}}>{player?.steamId||"—"}</div>
          <div style={{fontSize:11,color:"#90a4ae",marginTop:4,lineHeight:1.4}}>{player?.country||"—"} · 创建于 {fmtDate(player?.created)}</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        <div style={{padding:"12px",borderRadius:12,background:"rgba(66,165,245,.08)",border:"1px solid rgba(66,165,245,.18)"}}><div style={{fontSize:10,color:"#78909c"}}>Rust 总时长</div><div style={{fontSize:20,fontWeight:800,color:"#42a5f5",fontFamily:"'JetBrains Mono',monospace"}}>{fmtHours(player?.playtimeHours)}</div></div>
        <div style={{padding:"12px",borderRadius:12,background:"rgba(255,193,7,.08)",border:"1px solid rgba(255,193,7,.18)"}}><div style={{fontSize:10,color:"#78909c"}}>最近两周</div><div style={{fontSize:20,fontWeight:800,color:"#ffc107",fontFamily:"'JetBrains Mono',monospace"}}>{fmtHours(player?.playtimeTwoWeeksHours)}</div></div>
        <div style={{padding:"12px",borderRadius:12,background:"rgba(239,83,80,.08)",border:"1px solid rgba(239,83,80,.18)"}}><div style={{fontSize:10,color:"#78909c"}}>已解锁成就</div><div style={{fontSize:20,fontWeight:800,color:"#ef5350",fontFamily:"'JetBrains Mono',monospace"}}>{fmtFull(player?.achievementsCount)}</div></div>
        <div style={{padding:"12px",borderRadius:12,background:"rgba(102,187,106,.08)",border:"1px solid rgba(102,187,106,.18)"}}><div style={{fontSize:10,color:"#78909c"}}>库存估值</div><div style={{fontSize:20,fontWeight:800,color:"#66bb6a",fontFamily:"'JetBrains Mono',monospace"}}>{totalValue==null?"—":`$${totalValue.toFixed(2)}`}</div></div>
        <div style={{padding:"12px",borderRadius:12,background:"rgba(171,71,188,.08)",border:"1px solid rgba(171,71,188,.18)"}}><div style={{fontSize:10,color:"#78909c"}}>服务器时长</div><div style={{fontSize:20,fontWeight:800,color:"#ce93d8",fontFamily:"'JetBrains Mono',monospace"}}>{fmtServerDuration(serverHours)}</div></div>
        <div style={{padding:"12px",borderRadius:12,background:"rgba(121,134,203,.08)",border:"1px solid rgba(121,134,203,.18)"}}><div style={{fontSize:10,color:"#78909c"}}>账号年龄</div><div style={{fontSize:20,fontWeight:800,color:"#9fa8da",fontFamily:"'JetBrains Mono',monospace"}}>{yearsSince(player?.created)}</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        <div style={{padding:"12px",borderRadius:12,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)"}}><div style={{fontSize:10,color:"#78909c"}}>最近活跃</div><div style={{fontSize:15,fontWeight:700,color:"#eceff1",lineHeight:1.35,overflowWrap:"anywhere"}}>{fmtDateTime(player?.lastLogoffAt||player?.lastLogoff)}</div></div>
        <div style={{padding:"12px",borderRadius:12,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)"}}><div style={{fontSize:10,color:"#78909c"}}>Profile 概览</div><div style={{fontSize:15,fontWeight:700,color:"#eceff1",lineHeight:1.35}}>官方 Steam 数据 + Rust Stats 映射</div></div>
      </div>
      <div style={{padding:"14px 16px",borderRadius:14,background:"linear-gradient(135deg,rgba(205,65,43,.12),rgba(255,193,7,.06))",border:"1px solid rgba(205,65,43,.18)"}}>
        <div style={{fontSize:10,color:"#78909c",letterSpacing:1.4,textTransform:"uppercase",marginBottom:6}}>综合评分</div>
        <div style={{display:"flex",alignItems:"baseline",gap:10}}>
          <div style={{fontSize:34,fontWeight:900,color:"#ff7043",fontFamily:"'JetBrains Mono',monospace"}}>{score}</div>
          <div style={{fontSize:12,color:"#b0bec5"}}>/ 100</div>
        </div>
        <div style={{fontSize:11,color:"#90a4ae",marginTop:6}}>基于 KD、爆头率、Rust 时长、服务器时长和库存估值的本地画像分。</div>
      </div>
    </div>
  );
}

// ─── KDA Panel ───
function KDAPanel({data,player,inventory,servers}) {
  if(data.error) return <ErrorBox msg={data.error}/>;
  const s=data.summary;
  const kc=s.kdRatio>=3?"#66bb6a":s.kdRatio>=1.5?"#ffa726":"#ef5350";
  const rating=s.kdRatio>=4?"🏆 传奇猎手":s.kdRatio>=2.5?"⚔️ 精英战士":s.kdRatio>=1.5?"🛡️ 老练玩家":s.kdRatio>=1?"🎯 合格战士":"🌱 成长中";
  const sections=data.sections||[];
  return (
    <div style={{animation:"fadeIn .5s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(360px,1fr))",gap:16,marginBottom:18,alignItems:"stretch"}}>
        <KdaProfileCard player={player} inventory={inventory} servers={servers} summary={s}/>
        <div style={{background:`linear-gradient(135deg,${kc}12,rgba(30,30,50,.4))`,borderRadius:18,padding:"24px 28px",border:`1px solid ${kc}22`,position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:22,flexWrap:"wrap"}}>
            <div style={{position:"relative",width:80,height:80}}>
              <svg viewBox="0 0 80 80" style={{transform:"rotate(-90deg)"}}><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.04)" strokeWidth="6"/><circle cx="40" cy="40" r="34" fill="none" stroke={kc} strokeWidth="6" strokeDasharray={`${Math.min(s.kdRatio/5,1)*213.6} 213.6`} strokeLinecap="round"/></svg>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:kc,fontFamily:"'JetBrains Mono',monospace"}}>{s.kdRatio}</div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:"#78909c",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>KD 综合评级</div>
              <div style={{fontSize:"clamp(22px,2.4vw,30px)",fontWeight:800,color:"#eceff1"}}>{rating}</div>
              <div style={{fontSize:12,color:"#78909c",marginTop:4,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.5}}>
                {fmtFull(s.kills)} 击杀 · {fmtFull(s.deaths)} 死亡 · {fmtFull(s.headshots)} 爆头
              </div>
              <div style={{fontSize:11,color:"#90a4ae",marginTop:6,lineHeight:1.5}}>
                准确率 = 玩家子弹命中 ÷ 子弹发射
                <br/>
                爆头率 = 爆头次数 ÷ 玩家子弹命中
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginTop:20}}>
            <StatCard icon="💀" label="击杀" value={fmtFull(s.kills)} color="#ef5350"/>
            <StatCard icon="☠️" label="死亡" value={fmtFull(s.deaths)} color="#78909c"/>
            <StatCard icon="🎯" label="爆头次数/击杀" value={`${fmtFull(s.headshots)} / ${fmtFull(s.kills)}`} color="#ab47bc"/>
            <StatCard icon="📊" label="KD" value={s.kdRatio} color={kc}/>
            <StatCard icon="🔫" label="准确率" value={fmtPercent(s.accuracy)} color="#42a5f5"/>
            <StatCard icon="🧠" label="爆头率" value={fmtPercent(s.headshotRate)} color="#ab47bc"/>
            <StatCard icon="🚀" label="火箭发射" value={fmtFull(s.rocketsFired)} color="#ff7043"/>
          </div>
        </div>
      </div>
      <div style={{background:"rgba(255,255,255,.02)",borderRadius:18,padding:"16px 18px",border:"1px solid rgba(255,255,255,.05)",marginBottom:18}}>
        <SectionTitle emoji="📌" title="战斗总览"/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
          {[
            ["🔫","子弹发射",fmtFull(s.bulletsFired)],
            ["🎯","玩家子弹命中",fmtFull(s.bulletsHitPlayer)],
            ["💥","子弹总命中",fmtFull(s.bulletsHit)],
            ["🏹","弓箭发射",fmtFull(s.arrowsFired)],
            ["🧨","霰弹发射",fmtFull(s.shotgunFired)],
            ["🚀","火箭发射",fmtFull(s.rocketsFired)],
            ["🧠","爆头率",fmtPercent(s.headshotRate)],
            ["📏","准确率",fmtPercent(s.accuracy)],
          ].map(([i,l,v],x)=><MiniStat key={x} icon={i} label={l} value={v}/>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>
        {sections.map((section)=><StatsSection key={section.id} section={section} layout="flow" formatValue={fmtFull}/>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  库存面板
// ═══════════════════════════════════════════════════
function InventoryPanel({data}) {
  if(data.error) return <ErrorBox msg={data.error}/>;
  const [view,setView]=useState("all"); // all | steamOnly | store
  const [sortBy,setSortBy]=useState("price");

  const ts=data.totalSummary||{};
  const ss=data.skinsSummary||{};
  const storeSummary=data.storeSummary||{};
  const skins=data.skins||[];
  const storeCatalog=data.storeCatalog||[];
  const filteredSkins=skins.filter((item)=>view==="steamOnly"?!String(item.source||"").includes("scmm"):true);
  const sortedSkins=[...filteredSkins].sort((a,b)=>sortBy==="name"?(a.nameCN||a.name).localeCompare(b.nameCN||b.name,"zh-CN"):(b.price||0)-(a.price||0));
  const sortedStore=[...storeCatalog].sort((a,b)=>{
    const ownedDelta=Number(Boolean(b.owned))-Number(Boolean(a.owned));
    if(ownedDelta) return ownedDelta;
    return (a.nameCN||a.name).localeCompare(b.nameCN||b.name,"zh-CN");
  });

  return (
    <div style={{animation:"fadeIn .5s ease"}}>
      {/* ── 总价值 Hero ── */}
      <div style={{background:"linear-gradient(135deg,rgba(255,193,7,.08),rgba(30,30,50,.4))",borderRadius:18,padding:"22px 26px",marginBottom:18,border:"1px solid rgba(255,193,7,.12)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:14,flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:11,color:"#78909c",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>账号总资产价值</div>
            <div style={{fontSize:"clamp(30px,4vw,44px)",fontWeight:900,color:"#ffc107",fontFamily:"'JetBrains Mono',monospace"}}>{fmtMoney(ts.totalValue)}</div>
          </div>
          <div style={{display:"flex",gap:18,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:"#78909c"}}>可交易</div>
              <div style={{fontSize:18,fontWeight:700,color:"#66bb6a",fontFamily:"'JetBrains Mono',monospace"}}>{fmtMoney(ts.tradableValue)}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:"#78909c"}}>官方商城命中价值</div>
              <div style={{fontSize:18,fontWeight:700,color:"#ab47bc",fontFamily:"'JetBrains Mono',monospace"}}>{fmtMoney(storeSummary.ownedValue)}</div>
            </div>
          </div>
        </div>
        {ss.error&&(
          <div style={{marginBottom:12,padding:"10px 12px",borderRadius:12,background:"rgba(255,167,38,.08)",border:"1px solid rgba(255,167,38,.16)",color:"#ffcc80",fontSize:12,lineHeight:1.5}}>
            {ss.error&&<div>库存估值不可用：{ss.error}</div>}
          </div>
        )}
        {storeSummary.error&&(
          <div style={{marginBottom:12,padding:"10px 12px",borderRadius:12,background:"rgba(66,165,245,.08)",border:"1px solid rgba(66,165,245,.16)",color:"#90caf9",fontSize:12,lineHeight:1.5}}>
            商城目录不可用：{storeSummary.error}
          </div>
        )}
        {/* Value breakdown */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <ValueChip label="库存价值" value={fmtMoney(ts.skinsValue)} color="#ffa726" count={`${fmtFull(ss.totalItems||0)}件 / ${fmtFull(ss.distinctItems||0)}种`}/>
          <ValueChip label="Steam 网页独有" value={fmtFull(ss.steamWebOnlyDistinct||0)} color="#42a5f5" count={`${fmtFull(ss.steamWebOnlyItems||0)}件`}/>
          <ValueChip label="SCMM 已定价" value={fmtFull(ss.pricedByScmmDistinct||0)} color="#66bb6a" count={`${fmtFull(ss.pricedByScmmItems||0)}件`}/>
          <ValueChip label="当前官方商城" value={fmtFull(storeSummary.totalItems||0)} color="#ab47bc" count={`已匹配 ${fmtFull(storeSummary.ownedCount||0)} 项`}/>
          <ValueChip label="不可交易价值" value={fmtMoney(storeSummary.ownedValue)} color="#8e24aa" count={`当前商城命中`}/>
          {Object.entries(ss.rarityCounts||{}).map(([r,c])=>(
            <div key={r} style={{padding:"3px 10px",borderRadius:12,background:RC[r]?.bg,border:`1px solid ${RC[r]?.bd}44`,fontSize:11,color:RC[r]?.tx,fontWeight:600}}>{rarityLabel[r]||r} ×{c}</div>
          ))}
        </div>
      </div>

      {/* ── View Tabs ── */}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {[["all","全部资产",ts.totalItems||0],["steamOnly","Steam 网页独有",ss.steamWebOnlyDistinct||0],["store","官方商城目录",storeSummary.totalItems||0]].map(([v,l,n])=>(
          <button key={v} onClick={()=>setView(v)} style={{
            padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
            background:view===v?"rgba(255,193,7,.12)":"rgba(255,255,255,.03)",
            color:view===v?"#ffc107":"#546e7a",transition:"all .2s",
          }}>{l} ({n})</button>
        ))}
      </div>

      {/* ── Skins Section ── */}
      {(view==="all"||view==="steamOnly")&&sortedSkins.length>0&&(
        <div>
          <SectionTitle emoji="🎨" title={view==="steamOnly"?`Steam 网页独有资产 (${fmtFull(ss.steamWebOnlyDistinct||sortedSkins.length)}种)`:`合并库存 (${fmtFull(ss.totalItems||0)}件 / ${fmtFull(ss.distinctItems||sortedSkins.length)}种)`}/>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {[["price","按价格"],["name","按名称"]].map(([v,l])=>(
              <button key={v} onClick={()=>setSortBy(v)} style={{padding:"5px 14px",borderRadius:8,border:"none",cursor:"pointer",background:sortBy===v?"rgba(255,193,7,.12)":"rgba(255,255,255,.03)",color:sortBy===v?"#ffc107":"#78909c",fontSize:12,fontWeight:600}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {sortedSkins.map((item,i)=>{
              const rc=RC[item.rarity]||RC.common;
              const sourceLabel=item.source==="steam-web+scmm"?"Steam 网页 + SCMM":item.source==="steam-web+market"?"Steam 网页 + 市场":item.source==="scmm-profile"?"SCMM":"Steam 网页";
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:rc.bg,borderRadius:12,border:`1px solid ${rc.bd}25`,transition:"all .2s",flexWrap:"wrap"}}>
                  {item.iconUrl?<img src={item.iconUrl} alt="" style={{width:42,height:42,borderRadius:8,background:"rgba(0,0,0,.3)"}}/>:<div style={{width:42,height:42,borderRadius:8,background:"rgba(0,0,0,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎨</div>}
                  <div style={{flex:1,minWidth:220}}>
                    <div style={{fontSize:14,fontWeight:700,color:rc.tx,overflowWrap:"anywhere"}}>{item.nameCN||item.name}</div>
                    {(item.nameCN&&item.nameCN!==item.name)&&<div style={{fontSize:11,color:"#78909c",marginTop:2,overflowWrap:"anywhere"}}>{item.name}</div>}
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                      <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>×{fmtFull(item.quantity||1)}</span>
                      <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>{item.type||"库存物品"}</span>
                      <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>{sourceLabel}</span>
                      {!item.tradable&&<span style={{fontSize:10,color:"#ffcc80",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,193,7,.18)"}}>账号绑定</span>}
                    </div>
                  </div>
                  <div style={{fontSize:15,fontWeight:700,color:item.price>10?"#ffc107":"#78909c",fontFamily:"'JetBrains Mono',monospace",marginLeft:"auto",minWidth:120,textAlign:"right"}}>
                    <div>{item.price>0?fmtMoney(item.price):"—"}</div>
                    <div style={{fontSize:10,color:"#546e7a",marginTop:4}}>{item.priceSource||"未定价"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(view==="all"||view==="store")&&sortedStore.length>0&&(
        <div style={{marginTop:view==="all"?18:0}}>
          <SectionTitle emoji="🛍️" title={`当前官方商城目录 (${fmtFull(storeSummary.totalItems||sortedStore.length)}项，已在库存匹配 ${fmtFull(storeSummary.ownedCount||0)} 项)`}/>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {sortedStore.map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:item.owned?"rgba(102,187,106,.08)":"rgba(255,255,255,.02)",borderRadius:12,border:`1px solid ${item.owned?"rgba(102,187,106,.18)":"rgba(255,255,255,.05)"}`,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:220}}>
                  <div style={{fontSize:14,fontWeight:700,color:item.owned?"#a5d6a7":"#eceff1",overflowWrap:"anywhere"}}>{item.nameCN||item.name}</div>
                  {(item.nameCN&&item.nameCN!==item.name)&&<div style={{fontSize:11,color:"#78909c",marginTop:2,overflowWrap:"anywhere"}}>{item.name}</div>}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                    <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>{item.category||"商城物品"}</span>
                    <span style={{fontSize:10,color:item.owned?"#a5d6a7":"#78909c",padding:"2px 8px",borderRadius:999,border:`1px solid ${item.owned?"rgba(102,187,106,.2)":"rgba(255,255,255,.08)"}`}}>{item.owned?"已在库存命中":"未在库存命中"}</span>
                    <span style={{fontSize:10,color:item.scmmAvailable?"#66bb6a":"#42a5f5",padding:"2px 8px",borderRadius:999,border:`1px solid ${item.scmmAvailable?"rgba(102,187,106,.18)":"rgba(66,165,245,.18)"}`}}>{item.scmmAvailable?"SCMM 可定价":"Steam 网页专属"}</span>
                  </div>
                </div>
                <div style={{marginLeft:"auto",textAlign:"right",minWidth:120}}>
                  <div style={{fontSize:15,fontWeight:800,color:"#ffc107",fontFamily:"'JetBrains Mono',monospace"}}>{item.priceText||"—"}</div>
                  {item.storeUrl&&<a href={item.storeUrl} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#64b5f6",textDecoration:"none"}}>打开商城</a>}
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
    <div style={{padding:"4px 12px",borderRadius:10,background:`${color}0a`,border:`1px solid ${color}22`,display:"flex",alignItems:"center",gap:6}}>
      <span style={{fontSize:12,fontWeight:700,color,fontFamily:"'JetBrains Mono',monospace"}}>{value}</span>
      <span style={{fontSize:10,color:"#78909c"}}>{label}</span>
      {count&&<span style={{fontSize:9,color:"#455a64"}}>({count})</span>}
    </div>
  );
}

// ─── Server Panel ───
function ServerPanel({data, candidatesPayload, selectedBmId, onSelectBm, onLoadSelected, onResetSelection, loading, error}) {
  const candidates = candidatesPayload?.candidates || [];
  const selectedCandidate = candidates.find((candidate)=>candidate.bmId===selectedBmId) || null;

  if((!data || data.error) && error) return <ErrorBox msg={error}/>;
  if(!data && candidates.length===0){
    return (
      <div style={{background:"rgba(255,255,255,.02)",borderRadius:18,padding:"22px",border:"1px solid rgba(255,255,255,.05)"}}>
        <div style={{fontSize:14,fontWeight:700,color:"#eceff1",marginBottom:8}}>服务器时长需要确认 BattleMetrics 用户</div>
        <div style={{fontSize:12,color:"#78909c",lineHeight:1.6}}>当前没有候选可选。你可以重新查询或检查 BattleMetrics Token。</div>
      </div>
    );
  }

  const maxH=data ? Math.max(...data.servers.map(s=>s.totalHours),1) : 1;
  const sm=data?.summary;
  return (
    <div style={{animation:"fadeIn .5s ease"}}>
      {candidates.length>0&&(
        <div style={{background:"rgba(255,255,255,.02)",borderRadius:18,padding:"18px",marginBottom:18,border:"1px solid rgba(255,255,255,.05)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:14}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:"#eceff1"}}>选择 BattleMetrics 用户</div>
              <div style={{fontSize:11,color:"#78909c",marginTop:4}}>重名时请手动确认，确认后再加载服务器时长。</div>
            </div>
            {data&&(
              <button onClick={onResetSelection} style={{padding:"8px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.03)",color:"#b0bec5",fontSize:12,cursor:"pointer"}}>
                重新选择
              </button>
            )}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {candidates.map((candidate)=>(
              <button
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
                    <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>候选分数 {candidate.score ?? 0}</span>
                    <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>会话预览 {candidate.sessionPreview?.count ?? 0}</span>
                    <span style={{fontSize:10,color:"#90a4ae",padding:"2px 8px",borderRadius:999,border:"1px solid rgba(255,255,255,.08)"}}>{candidate.lastSeen?`最近出现 ${timeAgo(candidate.lastSeen)}`:"无最近记录"}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:14}}>
            <div style={{fontSize:11,color:"#78909c"}}>
              {selectedCandidate?`当前已选择：${selectedCandidate.name} (${selectedCandidate.bmId})`:"先从上面选择一个用户"}
            </div>
            <button
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
              {loading?"⏳ 加载中":"加载所选用户服务器时长"}
            </button>
          </div>
        </div>
      )}

      {loading&&(
        <div style={{padding:"14px 16px",borderRadius:14,background:"rgba(33,150,243,.08)",border:"1px solid rgba(33,150,243,.16)",color:"#90caf9",fontSize:12,marginBottom:18}}>
          正在加载所选 BattleMetrics 用户的服务器时长...
        </div>
      )}
      {!data ? null : (
      <>
      <div style={{background:"linear-gradient(135deg,rgba(33,150,243,.08),rgba(30,30,50,.4))",borderRadius:18,padding:"24px 28px",marginBottom:20,border:"1px solid rgba(33,150,243,.12)"}}>
        <div style={{fontSize:11,color:"#78909c",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>总游玩时长</div>
        <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:"clamp(30px,4vw,46px)",fontWeight:900,color:"#42a5f5",fontFamily:"'JetBrains Mono',monospace"}}>{fmtServerDuration(sm.totalHours)}</span>
          <span style={{fontSize:13,color:"#455a64",marginLeft:8}}>{sm.totalHours >= 24 ? `≈ ${sm.totalDays} 天` : `共 ${sm.totalSessions} 次会话`}</span>
        </div>
        <div style={{display:"flex",gap:16,marginTop:10,fontSize:12,color:"#546e7a",flexWrap:"wrap"}}>
          <span>🖥️ {sm.serverCount} 服务器</span><span>📋 {sm.totalSessions} 次会话</span>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {data.servers.map((srv,i)=>{
          const pct=(srv.totalHours/maxH)*100;const on=srv.status==="online";
          return (
            <div key={i} style={{background:"rgba(255,255,255,.02)",borderRadius:12,padding:"14px 16px",border:"1px solid rgba(255,255,255,.04)",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:`${pct}%`,background:"rgba(33,150,243,.05)"}}/>
              <div style={{position:"relative",zIndex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:10,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,flex:"1 1 300px"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:on?"#66bb6a":"#ef5350",boxShadow:on?"0 0 6px rgba(102,187,106,.5)":"none"}}/>
                    <span style={{fontSize:13,fontWeight:600,color:"#e0e0e0",overflowWrap:"anywhere"}}>{srv.name}</span>
                  </div>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:on?"rgba(102,187,106,.08)":"rgba(239,83,80,.08)",color:on?"#66bb6a":"#ef5350"}}>{on?`在线 ${srv.players}`:"离线"}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:12,fontSize:11,color:"#546e7a",flexWrap:"wrap"}}><span>🌐 {srv.country}</span><span>📋 {srv.sessionCount}次</span><span>🕐 {timeAgo(srv.lastSeen)}</span></div>
                  <div style={{fontSize:17,fontWeight:800,color:"#42a5f5",fontFamily:"'JetBrains Mono',monospace"}}>{fmtServerDuration(srv.totalHours)}</div>
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
  const [tab,setTab]=useState("kda");
  const [steamId,setSteamId]=useState("");
  const [loading,setLoading]=useState(false);
  const [authChecked,setAuthChecked]=useState(false);
  const [authenticated,setAuthenticated]=useState(false);
  const [authPassword,setAuthPassword]=useState("");
  const [authError,setAuthError]=useState("");
  const [authLoading,setAuthLoading]=useState(false);
  const [player,setPlayer]=useState(null);
  const [kda,setKda]=useState(null);
  const [inv,setInv]=useState(null);
  const [srv,setSrv]=useState(null);
  const [serverCandidates,setServerCandidates]=useState(null);
  const [selectedBmId,setSelectedBmId]=useState("");
  const [serverLoading,setServerLoading]=useState(false);
  const [serverError,setServerError]=useState("");
  const [demo,setDemo]=useState(false);

  const apiJson = useCallback(async (path, options = {}) => {
    const headers = {...(options.headers||{})};
    const hasBody = options.body != null;
    if(hasBody && !headers["Content-Type"]){
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers,
    });
    const payload = await response.json().catch(()=>({}));
    if(response.status === 401){
      startTransition(()=>{
        setAuthenticated(false);
        setAuthChecked(true);
        setAuthError(payload?.error || "");
      });
      throw new Error("__UNAUTHORIZED__");
    }
    if(!response.ok || payload?.error){
      throw new Error(payload?.error || "请求失败");
    }
    return payload;
  }, []);

  useEffect(()=>{
    let mounted = true;
    fetch(`${API_BASE}/auth/status`, {credentials:"include"})
      .then((response)=>response.json().catch(()=>({authenticated:false})))
      .then((payload)=>{
        if(!mounted) return;
        startTransition(()=>{
          setAuthenticated(Boolean(payload?.authenticated));
          setAuthChecked(true);
        });
      })
      .catch(()=>{
        if(!mounted) return;
        startTransition(()=>{
          setAuthenticated(false);
          setAuthChecked(true);
        });
      });
    return ()=>{ mounted = false; };
  }, []);

  const login = useCallback(async ()=>{
    if(!authPassword.trim()) return;
    startTransition(()=>{
      setAuthLoading(true);
      setAuthError("");
    });
    try{
      await apiJson("/auth/login", {
        method: "POST",
        body: JSON.stringify({password: authPassword}),
      });
      startTransition(()=>{
        setAuthenticated(true);
        setAuthPassword("");
      });
    }catch(err){
      if(err.message !== "__UNAUTHORIZED__"){
        startTransition(()=>setAuthError(err.message || "登录失败"));
      }
    }
    startTransition(()=>setAuthLoading(false));
  }, [apiJson, authPassword]);

  const logout = useCallback(async ()=>{
    try{
      await fetch(`${API_BASE}/auth/logout`, {method:"POST", credentials:"include"});
    } finally {
      startTransition(()=>{
        setAuthenticated(false);
        setPlayer(null);
        setKda(null);
        setInv(null);
        setSrv(null);
        setServerCandidates(null);
        setSelectedBmId("");
        setServerError("");
      });
    }
  }, []);

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
      if(err.message !== "__UNAUTHORIZED__"){
        startTransition(()=>setServerError(err?.message || "服务器时长加载失败"));
      }
    }
    startTransition(()=>setServerLoading(false));
  },[apiJson]);

  const query=useCallback(async()=>{
    if(!steamId.trim() || !authenticated) return;
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
            setServerError("没有找到可确认的 BattleMetrics 用户");
          }
        }else{
          setServerError("BattleMetrics 候选搜索失败");
        }
      });
    } catch (err) {
      if(err.message !== "__UNAUTHORIZED__"){
        startTransition(()=>{
          setDemo(true);
          setPlayer({steamId,name:"Demo_Player",status:"演示模式",country:"CN",created:1609459200,lastLogoff:1712102400,playtimeHours:2890.4,playtimeTwoWeeksHours:36.5,achievementsCount:67});
          setKda(DEMO.kda); setInv(DEMO.inventory); setSrv(DEMO.servers); setServerCandidates({steamId,playerName:"Demo_Player",candidates:[{bmId:"demo-1",name:"Demo_Player",score:100,sessionPreview:{count:4,hasMore:false},lastSeen:new Date().toISOString()}]}); setSelectedBmId("demo-1");
        });
      }
    }
    startTransition(()=>setLoading(false));
  },[authenticated, apiJson, steamId]);

  const tabs=[
    {id:"kda",label:"KDA 数据",icon:"⚔️",color:"#ef5350"},
    {id:"inventory",label:"库存",icon:"💰",color:"#ffc107"},
    {id:"servers",label:"服务器时长",icon:"🖥️",color:"#42a5f5"},
  ];

  if(!authChecked){
    return (
      <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#08080d",color:"#e0e0e0",fontFamily:"'Noto Sans SC',-apple-system,sans-serif"}}>
        <div style={{fontSize:14,color:"#78909c"}}>正在检查访问权限...</div>
      </div>
    );
  }

  if(!authenticated){
    return (
      <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#08080d",color:"#e0e0e0",fontFamily:"'Noto Sans SC',-apple-system,sans-serif",padding:"24px"}}>
        <div style={{width:"min(100%,420px)",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:20,padding:"28px"}}>
          <div style={{fontSize:22,fontWeight:800,marginBottom:8}}>访问验证</div>
          <div style={{fontSize:12,color:"#78909c",lineHeight:1.6,marginBottom:18}}>请输入入口密码后再使用查询功能。</div>
          <input
            type="password"
            value={authPassword}
            onChange={(e)=>setAuthPassword(e.target.value)}
            onKeyDown={(e)=>e.key==="Enter"&&login()}
            placeholder="请输入入口密码"
            style={{width:"100%",padding:"12px 14px",borderRadius:12,background:"rgba(255,255,255,.035)",border:"1px solid rgba(255,255,255,.08)",color:"#e0e0e0",fontSize:14,outline:"none"}}
          />
          {authError&&<div style={{marginTop:12,fontSize:12,color:"#ef9a9a"}}>{authError}</div>}
          <button
            onClick={login}
            disabled={authLoading}
            style={{marginTop:16,width:"100%",padding:"12px 16px",borderRadius:12,border:"none",background:authLoading?"rgba(205,65,43,.25)":"linear-gradient(135deg,#cd412b,#e65100)",color:"#fff",fontSize:14,fontWeight:700,cursor:authLoading?"wait":"pointer"}}
          >
            {authLoading?"正在验证...":"进入网站"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:"#08080d",fontFamily:"'Noto Sans SC',-apple-system,sans-serif",color:"#e0e0e0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}
        input::placeholder{color:#37474f}
        body{background:#08080d}
        .app-shell{width:min(100%,1760px);margin:0 auto;padding:0 clamp(12px,2.4vw,28px) 28px}
        .header-shell{padding:20px clamp(12px,2.4vw,28px) 16px}
        .search-shell{display:flex;gap:8px;flex-wrap:wrap}
        .search-shell input{min-width:240px}
        .tab-shell{display:flex;gap:6px;flex-wrap:wrap;padding:0 clamp(12px,2.4vw,28px) 10px}
        .content-shell{padding-top:18px}
        .player-shell{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px;padding:14px 18px;background:rgba(255,255,255,.02);border-radius:14px;border:1px solid rgba(255,255,255,.04)}
        @media (max-width: 900px){
          .header-shell{padding-top:16px}
          .tab-shell{padding-bottom:8px}
        }
        @media (max-width: 640px){
          .search-shell input{min-width:0;width:100%}
        }
      `}</style>

      {/* Header */}
      <div style={{background:"linear-gradient(180deg,rgba(205,65,43,.06) 0%,transparent 100%)",borderBottom:"1px solid rgba(255,255,255,.03)"}} className="header-shell">
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#cd412b,#e65100)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"#fff",boxShadow:"0 4px 18px rgba(205,65,43,.35)",fontFamily:"'JetBrains Mono',monospace"}}>R</div>
          <div style={{flex:1}}><div style={{fontSize:18,fontWeight:800,letterSpacing:-.5}}>Rust 玩家查询工具</div><div style={{fontSize:10,color:"#455a64",letterSpacing:1}}>KDA · INVENTORY · PLAYTIME</div></div>
          <button onClick={logout} style={{padding:"8px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.03)",color:"#b0bec5",fontSize:12,cursor:"pointer"}}>退出</button>
        </div>
        <div className="search-shell">
          <input value={steamId} onChange={e=>setSteamId(e.target.value)} onKeyDown={e=>e.key==="Enter"&&query()}
            placeholder="Steam ID64 / 自定义 URL / Vanity 名称..."
            style={{flex:1,padding:"11px 14px",borderRadius:10,background:"rgba(255,255,255,.035)",border:"1px solid rgba(255,255,255,.06)",color:"#e0e0e0",fontSize:13,outline:"none",fontFamily:"'JetBrains Mono',monospace"}}
          />
          <button onClick={query} disabled={loading} style={{padding:"10px 22px",borderRadius:10,border:"none",background:loading?"rgba(205,65,43,.25)":"linear-gradient(135deg,#cd412b,#e65100)",color:"#fff",fontSize:13,fontWeight:700,cursor:loading?"wait":"pointer",boxShadow:loading?"none":"0 4px 15px rgba(205,65,43,.3)",whiteSpace:"nowrap"}}>
            {loading?"⏳":"🔍"} 查询
          </button>
        </div>
        {demo&&<div style={{marginTop:10,padding:"6px 12px",borderRadius:8,background:"rgba(255,167,38,.08)",border:"1px solid rgba(255,167,38,.15)",fontSize:11,color:"#ffa726",textAlign:"center"}}>⚡ 演示模式 — 后端未连接。运行 python rust_query_server_v2.py 启用真实查询</div>}
      </div>

      {/* Tabs */}
      <div style={{borderBottom:"1px solid rgba(255,255,255,.03)",background:"rgba(0,0,0,.15)"}} className="tab-shell">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 14px",border:"none",background:tab===t.id?`${t.color}0d`:"transparent",color:tab===t.id?t.color:"#455a64",fontSize:12,fontWeight:600,cursor:"pointer",borderBottom:tab===t.id?`2px solid ${t.color}`:"2px solid transparent",display:"flex",alignItems:"center",gap:5,transition:"all .2s"}}>
            <span style={{fontSize:13}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="app-shell">
      <div className="content-shell">
        {loading?(
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{display:"inline-block",animation:"spin 1s linear infinite"}}><svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="rgba(205,65,43,.3)" strokeWidth="3"/><circle cx="16" cy="16" r="12" fill="none" stroke="#cd412b" strokeWidth="3" strokeDasharray="40 36" strokeLinecap="round"/></svg></div>
            <div style={{fontSize:13,color:"#546e7a",marginTop:12,animation:"pulse 1.5s infinite"}}>正在查询数据...</div>
          </div>
        ):!player?(
          <div style={{textAlign:"center",padding:"60px 20px",color:"#263238"}}>
            <div style={{fontSize:52,marginBottom:14,opacity:.2}}>🎮</div>
            <div style={{fontSize:14,color:"#37474f"}}>输入 Steam ID 开始查询</div>
            <div style={{fontSize:11,color:"#1a1a1a",marginTop:6}}>支持 SteamID64 / 自定义 URL / Vanity 名称</div>
          </div>
        ):(
          <>
            <div className="player-shell">
              {player.avatarMedium?<img src={player.avatarMedium} alt="" style={{width:48,height:48,borderRadius:12,border:"2px solid rgba(255,255,255,.08)"}}/>:<div style={{width:48,height:48,borderRadius:12,background:"linear-gradient(135deg,#cd412b,#e65100)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#fff"}}>{player.name?.[0]?.toUpperCase()||"?"}</div>}
              <div style={{flex:1,minWidth:220}}><div style={{fontSize:16,fontWeight:700,overflowWrap:"anywhere"}}>{player.name}</div><div style={{fontSize:11,color:"#455a64",fontFamily:"'JetBrains Mono',monospace",overflowWrap:"anywhere"}}>{player.steamId||steamId}</div></div>
              <div style={{padding:"4px 10px",borderRadius:8,background:player.status==="在线"||player.status==="游戏中"?"rgba(102,187,106,.08)":"rgba(120,144,156,.08)",fontSize:11,fontWeight:600,color:player.status==="在线"||player.status==="游戏中"?"#66bb6a":"#78909c"}}>{player.status}</div>
            </div>
            {tab==="kda"&&kda&&<KDAPanel data={kda} player={player} inventory={inv} servers={srv}/>}
            {tab==="inventory"&&inv&&<InventoryPanel data={inv}/>}
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
              />
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
