"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Zap, Search, PenTool, Link, Sparkles,
  Rocket, Megaphone, Filter, Hourglass, CheckCircle, Database,
  FileText, Layers, Trash2, Edit2, Play, Plus, X, Clock
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const MOD_SIZE = 114; // Slightly larger for that premium feel
const PORT_R = 7;
const CANVAS_W = 5000;
const CANVAS_H = 4000;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.0;

// ─── Types ────────────────────────────────────────────────────────────────────
type MType = "trigger"|"topic-scout"|"article-writer"|"image-sourcer"|"ai-image-gen"|"publisher"|"social-poster"|"conditional-check"|"rate-limiter"|"content-quality"|"content-cache";
interface WModule { id:string; type:MType; x:number; y:number; settings:Record<string,unknown>; }
interface WConn   { id:string; fromId:string; toId:string; }
interface BotWorkflow { modules:WModule[]; connections:WConn[]; }
interface View     { panX:number; panY:number; zoom:number; }

// Bot entry stored in site_settings "bots" key
interface BotEntry {
  id: string;
  name: string;
  type: "article_only" | "full";
  enabled: boolean;
  interval_hours: number;
  schedule_hours?: number[];   // hodiny (SK čas) kedy sa spúšťa
  categories: string[];
  post_instagram?: boolean;
  post_facebook?: boolean;
  instagram_format?: string;
  auto_publish_social?: boolean;
  last_run?: string | null;
  processed_count?: number;
  last_category?: string;
  workflow?: BotWorkflow;
}

type FieldDef =
  | {key:string;label:string;type:"text";       default:string}
  | {key:string;label:string;type:"number";     default:number;min?:number;max?:number}
  | {key:string;label:string;type:"select";     options:{value:string;label:string}[];default:string}
  | {key:string;label:string;type:"toggle";     default:boolean}
  | {key:string;label:string;type:"multiselect";options:{value:string;label:string}[];default:string[]};

interface MDef {
  label:string;desc:string;emoji:string;icon:any;
  color:string;bg:string;border:string;
  hasIn:boolean;hasOut:boolean;
  defaults:Record<string,unknown>;fields:FieldDef[];
}

// Generate hour options 0-23 for the cron trigger
const HOUR_OPTIONS = Array.from({length:24},(_,i)=>({value:String(i),label:(i<10?"0"+i:String(i))+":00"}));

const DEFS: Record<MType, MDef> = {
  "trigger":{label:"Cron / Spúšťač",desc:"Kedy a ako často sa bot spustí",emoji:"⏰",icon:Clock,color:"#f59e0b",bg:"rgba(245,158,11,0.15)",border:"rgba(245,158,11,0.4)",hasIn:false,hasOut:true,
    defaults:{enabled:true,scheduleHours:["8","14","20"],intervalHours:0},
    fields:[
      {key:"enabled",label:"Bot aktívny",type:"toggle",default:true},
      {key:"scheduleHours",label:"Hodiny spustenia (SK čas)",type:"multiselect",options:HOUR_OPTIONS,default:["9","15","20"]},
      {key:"intervalHours",label:"Alebo každých N hodín (0 = vypnuté)",type:"number",default:0,min:0,max:24}]},
  "topic-scout":{label:"Prieskum Tém",desc:"Hľadá aktuálne témy cez Gemini",emoji:"🔍",icon:Search,color:"#3b82f6",bg:"rgba(59,130,246,0.15)",border:"rgba(59,130,246,0.3)",hasIn:true,hasOut:true,
    defaults:{categories:["AI"],timeRange:"48h",googleSearch:true,dedup:true},
    fields:[
      {key:"categories",label:"Kategórie",type:"multiselect",options:[{value:"AI",label:"AI"},{value:"Tech",label:"Tech"},{value:"Návody & Tipy",label:"Návody & Tipy"}],default:["AI"]},
      {key:"timeRange",label:"Časový rozsah",type:"select",options:[{value:"24h",label:"Posledných 24h"},{value:"48h",label:"Posledných 48h"},{value:"7d",label:"Posledný týždeň"}],default:"48h"},
      {key:"googleSearch",label:"Použiť Google Search",type:"toggle",default:true},
      {key:"dedup",label:"Preskočiť už publikované",type:"toggle",default:true}]},
  "article-writer":{label:"Písanie Článku",desc:"Generuje plný článok v SK",emoji:"✍️",icon:PenTool,color:"#8b5cf6",bg:"rgba(139,92,246,0.15)",border:"rgba(139,92,246,0.3)",hasIn:true,hasOut:true,
    defaults:{language:"sk",minWords:400,style:"journalistic",addSummary:true},
    fields:[
      {key:"language",label:"Jazyk",type:"select",options:[{value:"sk",label:"Slovenčina"},{value:"en",label:"English"},{value:"cs",label:"Čeština"}],default:"sk"},
      {key:"minWords",label:"Minimálny počet slov",type:"number",default:400,min:200,max:2000},
      {key:"style",label:"Štýl články",type:"select",options:[{value:"journalistic",label:"Žurnalistický"},{value:"casual",label:"Neformálny"},{value:"technical",label:"Technický"}],default:"journalistic"},
      {key:"addSummary",label:"Generovať zvukové zhrnutie",type:"toggle",default:true}]},
  "image-sourcer":{label:"Scraping Obrázkov",desc:"Berie obrázky zo zdrojového URL",emoji:"🔗",icon:Link,color:"#f59e0b",bg:"rgba(245,158,11,0.15)",border:"rgba(245,158,11,0.3)",hasIn:true,hasOut:true,
    defaults:{tryOg:true,tryArticle:true,minWidth:300,minHeight:200},
    fields:[
      {key:"tryOg",label:"Vziať OG Image z meta tagov",type:"toggle",default:true},
      {key:"tryArticle",label:"Vziať obrázky z obsahu články",type:"toggle",default:true},
      {key:"minWidth",label:"Min. šírka obrázka (px)",type:"number",default:300,min:100,max:2000},
      {key:"minHeight",label:"Min. výška obrázka (px)",type:"number",default:200,min:100,max:2000}]},
  "ai-image-gen":{label:"AI Generátor Obrázkov",desc:"Gemini generuje chýbajúce obrázky",emoji:"✨",icon:Sparkles,color:"#ec4899",bg:"rgba(236,72,153,0.15)",border:"rgba(236,72,153,0.3)",hasIn:true,hasOut:true,
    defaults:{model:"gemini",count:3,style:"editorial",smartPrompts:true},
    fields:[
      {key:"model",label:"AI Model",type:"select",options:[{value:"gemini",label:"Gemini Imagen"},{value:"dalle",label:"DALL-E 3"}],default:"gemini"},
      {key:"count",label:"Počet obrázkov",type:"number",default:3,min:1,max:5},
      {key:"style",label:"Štýl obrázkov",type:"select",options:[{value:"editorial",label:"Editoriál (vysoká kvalita)"},{value:"documentary",label:"Dokumentárny"},{value:"product",label:"Produktový"}],default:"editorial"},
      {key:"smartPrompts",label:"Inteligentné prompty (analyza textu)",type:"toggle",default:true}]},
  publisher:{label:"Publikovanie",desc:"Uloží a zverejní článok na webe",emoji:"🚀",icon:Rocket,color:"#06b6d4",bg:"rgba(6,182,212,0.15)",border:"rgba(6,182,212,0.3)",hasIn:true,hasOut:true,
    defaults:{status:"published",revalidate:true,featuredImage:true},
    fields:[
      {key:"status",label:"Stav publikácie",type:"select",options:[{value:"published",label:"Okamžite publikovať"},{value:"draft",label:"Uložiť ako koncept"}],default:"published"},
      {key:"revalidate",label:"Revalidovať cache (rýchlejšie)",type:"toggle",default:true},
      {key:"featuredImage",label:"Nastaviť 1. obrázok ako featured",type:"toggle",default:true}]},
  "social-poster":{label:"Sociálne Siete",desc:"Postuje na Instagram & Facebook",emoji:"📢",icon:Megaphone,color:"#d946ef",bg:"rgba(217,70,239,0.15)",border:"rgba(217,70,239,0.3)",hasIn:true,hasOut:false,
    defaults:{platforms:["Instagram"],imageFormat:"photo",hashtags:"",addLink:true,autoPublish:true},
    fields:[
      {key:"platforms",label:"Kam postovať",type:"multiselect",options:[{value:"Instagram",label:"Instagram"},{value:"Facebook",label:"Facebook"}],default:["Instagram"]},
      {key:"imageFormat",label:"Typ obrázka",type:"select",options:[{value:"photo",label:"🖼 Foto z článku"},{value:"studio",label:"⬛ Studio pozadie"},{value:"article_bg",label:"🌅 Foto s pozadím"}],default:"photo"},
      {key:"hashtags",label:"Hashtags (napr. #AI #tech)",type:"text",default:""},
      {key:"addLink",label:"Pridať odkaz na článok",type:"toggle",default:true},
      {key:"autoPublish",label:"Okamžité publikovanie",type:"toggle",default:true}]},
  "conditional-check":{label:"Podmienenka",desc:"Pokračuje len ak je podmienka splnená",emoji:"🔀",icon:Filter,color:"#6b7280",bg:"rgba(107,114,128,0.15)",border:"rgba(107,114,128,0.3)",hasIn:true,hasOut:true,
    defaults:{field:"category",operator:"equals",value:"AI"},
    fields:[
      {key:"field",label:"Pole",type:"select",options:[{value:"category",label:"Kategória"},{value:"hasUrl",label:"Má URL"},{value:"hasImages",label:"Má obrázky"},{value:"wordCount",label:"Počet slov"}],default:"category"},
      {key:"operator",label:"Operátor",type:"select",options:[{value:"equals",label:"rovná sa"},{value:"not_equals",label:"nerovná sa"},{value:"contains",label:"obsahuje"},{value:"gt",label:"väčší ako"},{value:"lt",label:"menší ako"}],default:"equals"},
      {key:"value",label:"Hodnota",type:"text",default:"AI"}]},
  "rate-limiter":{label:"Trotl / Pauza",desc:"Čaká či aplikuje throttling",emoji:"⏳",icon:Hourglass,color:"#94a3b8",bg:"rgba(148,163,184,0.15)",border:"rgba(148,163,184,0.3)",hasIn:true,hasOut:true,
    defaults:{seconds:60,maxPerHour:10,maxPerDay:100},
    fields:[
      {key:"seconds",label:"Pauza (sec) medzi behmi",type:"number",default:60,min:1,max:3600},
      {key:"maxPerHour",label:"Max behov za hodinu",type:"number",default:10,min:1,max:60},
      {key:"maxPerDay",label:"Max behov za deň",type:"number",default:100,min:1,max:1000}]},
  "content-quality":{label:"Kontrola Kvality",desc:"Overuje kvalitu články pred publikáciou",emoji:"✅",icon:CheckCircle,color:"#10b981",bg:"rgba(16,185,129,0.15)",border:"rgba(16,185,129,0.3)",hasIn:true,hasOut:true,
    defaults:{minWordCount:300},
    fields:[
      {key:"minWordCount",label:"Min. počet slov",type:"number",default:300,min:100,max:2000}]},
  "content-cache":{label:"Cache Obsahu",desc:"Cachuje vygenerovaný obsah pre rýchlosť",emoji:"💾",icon:Database,color:"#f97316",bg:"rgba(249,115,22,0.15)",border:"rgba(249,115,22,0.3)",hasIn:true,hasOut:true,
    defaults:{cacheExpiry:24},
    fields:[
      {key:"cacheExpiry",label:"Cache platný (hodiny)",type:"number",default:24,min:1,max:168}]},
};

const PALETTE: MType[] = ["trigger","topic-scout","article-writer","image-sourcer","ai-image-gen","publisher","social-poster","conditional-check","rate-limiter","content-quality","content-cache"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return `m_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }
function cuid(){ return `c_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }
function botId(){ return `bot_${Date.now()}`; }
function bezier(x1:number,y1:number,x2:number,y2:number){
  const cx = x1 + (x2 - x1) / 2;
  return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
}
function outPt(m:WModule){return{x:m.x+MOD_SIZE,y:m.y+MOD_SIZE/2};}
function inPt(m:WModule) {return{x:m.x,   y:m.y+MOD_SIZE/2};}

function defaultWF(): BotWorkflow {
  // New bots start with trigger disabled — user must configure & enable
  const tr = {id:uid(),type:"trigger"        as MType,x:0,   y:300,settings:{...DEFS["trigger"].defaults,enabled:false}};
  const s  = {id:uid(),type:"topic-scout"    as MType,x:200, y:300,settings:{...DEFS["topic-scout"].defaults}};
  const a  = {id:uid(),type:"article-writer" as MType,x:400, y:200,settings:{...DEFS["article-writer"].defaults}};
  const im = {id:uid(),type:"image-sourcer"  as MType,x:400, y:400,settings:{...DEFS["image-sourcer"].defaults}};
  const g  = {id:uid(),type:"ai-image-gen"   as MType,x:600,y:300,settings:{...DEFS["ai-image-gen"].defaults}};
  const p  = {id:uid(),type:"publisher"      as MType,x:800,y:300,settings:{...DEFS["publisher"].defaults}};
  const so = {id:uid(),type:"social-poster"  as MType,x:1000,y:300,settings:{...DEFS["social-poster"].defaults}};
  return {
    modules:[tr,s,a,im,g,p,so],
    connections:[
      {id:cuid(),fromId:tr.id,toId:s.id},
      {id:cuid(),fromId:s.id, toId:a.id},
      {id:cuid(),fromId:s.id, toId:im.id},
      {id:cuid(),fromId:a.id, toId:g.id},
      {id:cuid(),fromId:im.id,toId:g.id},
      {id:cuid(),fromId:g.id, toId:p.id},
      {id:cuid(),fromId:p.id, toId:so.id},
    ],
  };
}

// Derive bot config from workflow modules
function deriveConfigFromWorkflow(wf: BotWorkflow) {
  const triggerMod   = wf.modules.find(m => m.type === "trigger");
  const topicScout   = wf.modules.find(m => m.type === "topic-scout");
  const socialPoster = wf.modules.find(m => m.type === "social-poster");
  const hasSocial = !!socialPoster;

  const categories = (topicScout?.settings?.categories as string[]) ?? ["AI"];
  const platforms  = (socialPoster?.settings?.platforms as string[]) ?? [];

  // Extract schedule from trigger module
  const scheduleHoursRaw = (triggerMod?.settings?.scheduleHours as string[]) ?? [];
  const scheduleHours = scheduleHoursRaw.map(h => parseInt(h, 10)).filter(h => !isNaN(h));
  const intervalHours = (triggerMod?.settings?.intervalHours as number) ?? 0;
  const botEnabled = (triggerMod?.settings?.enabled as boolean) ?? true;

  return {
    enabled: botEnabled,
    type: (hasSocial ? "full" : "article_only") as "article_only" | "full",
    categories,
    post_instagram: platforms.includes("Instagram"),
    post_facebook: platforms.includes("Facebook"),
    instagram_format: (socialPoster?.settings?.imageFormat as string) ?? "photo",
    auto_publish_social: (socialPoster?.settings?.autoPublish as boolean) ?? true,
    schedule_hours: scheduleHours.length > 0 ? scheduleHours : undefined,
    interval_hours: intervalHours > 0 ? intervalHours : 4,
  };
}

function generateWorkflowFromLegacyConfig(bot: BotEntry): BotWorkflow {
  // Restore schedule_hours from bot config into trigger module (string array for multiselect)
  const savedHours = (bot.schedule_hours || []).map(h => String(h));
  const tr = {id:uid(),type:"trigger" as MType,x:0,y:300,settings:{
    ...DEFS["trigger"].defaults,
    enabled: bot.enabled ?? true,
    scheduleHours: savedHours.length > 0 ? savedHours : DEFS["trigger"].defaults.scheduleHours,
    intervalHours: bot.interval_hours ?? 0,
  }};
  const s  = {id:uid(),type:"topic-scout"    as MType,x:200, y:300,settings:{...DEFS["topic-scout"].defaults,categories:bot.categories}};
  const a  = {id:uid(),type:"article-writer" as MType,x:400, y:200,settings:{...DEFS["article-writer"].defaults}};
  const im = {id:uid(),type:"image-sourcer"  as MType,x:400, y:400,settings:{...DEFS["image-sourcer"].defaults}};
  const g  = {id:uid(),type:"ai-image-gen"   as MType,x:600,y:300,settings:{...DEFS["ai-image-gen"].defaults}};
  const p  = {id:uid(),type:"publisher"      as MType,x:800,y:300,settings:{...DEFS["publisher"].defaults}};

  const modules: WModule[] = [tr,s,a,im,g,p];
  const connections: WConn[] = [
    {id:cuid(),fromId:tr.id,toId:s.id},
    {id:cuid(),fromId:s.id, toId:a.id},
    {id:cuid(),fromId:s.id, toId:im.id},
    {id:cuid(),fromId:a.id, toId:g.id},
    {id:cuid(),fromId:im.id,toId:g.id},
    {id:cuid(),fromId:g.id, toId:p.id},
  ];

  // Add social-poster for full bots
  if(bot.type === "full") {
    const so = {id:uid(),type:"social-poster" as MType,x:1200,y:300,settings:{
      ...DEFS["social-poster"].defaults,
      platforms: [],
      imageFormat: bot.instagram_format || "photo",
      autoPublish: bot.auto_publish_social ?? true,
    }};
    if(bot.post_instagram) (so.settings.platforms as string[]).push("Instagram");
    if(bot.post_facebook) (so.settings.platforms as string[]).push("Facebook");

    modules.push(so);
    connections.push({id:cuid(),fromId:p.id, toId:so.id});
  }

  return { modules, connections };
}

function defaultBot(): BotEntry {
  const wf = defaultWF();
  const derived = deriveConfigFromWorkflow(wf); // derived.enabled = false (from trigger default)
  return {
    id: botId(),
    name: "Nový Bot",
    ...derived,  // enabled: false comes from trigger module default
    last_run: null,
    processed_count: 0,
    workflow: wf,
  };
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({mod,onChange,onClose,onDelete}:{mod:WModule;onChange:(s:Record<string,unknown>)=>void;onClose:()=>void;onDelete:()=>void;}){
  const def=DEFS[mod.type];
  const s=mod.settings;
  function set(key:string,val:unknown){onChange({...s,[key]:val});}
  function toggleMulti(key:string,val:string){
    const arr=(s[key] as string[])||[];
    set(key,arr.includes(val)?arr.filter(x=>x!==val):[...arr,val]);
  }
  return (
    <div style={{width:280,flexShrink:0,background:"rgba(10,10,10,0.7)",backdropFilter:"blur(20px)",borderLeft:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",overflow:"hidden",animation:"slideIn 0.2s ease"}}>
      <div style={{padding:"18px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:34,height:34,borderRadius:10,background:def.bg,border:`1px solid ${def.border}`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 12px ${def.color}20`}}>
          <def.icon size={18} color={def.color} />
        </div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:13,fontWeight:800,color:"#fff",margin:0,letterSpacing:"-0.01em"}}>{def.label}</p>
          <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",margin:0,fontWeight:500}}>{def.desc}</p>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,color:"rgba(255,255,255,0.3)",cursor:"pointer",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>✕</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:16}}>
        {def.fields.map(f=>(
          <div key={f.key}>
            <label style={{display:"block",fontSize:9,fontWeight:900,color:"rgba(255,255,255,0.25)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>{f.label}</label>
            {f.type==="text"&&<input value={(s[f.key] as string)??f.default} onChange={e=>set(f.key,e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 12px",color:"#fff",fontSize:12,fontWeight:500,outline:"none",boxSizing:"border-box",transition:"all 0.2s"}} onFocus={e=>e.currentTarget.style.borderColor=def.color+"70"} onBlur={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}/>}
            {f.type==="number"&&<input type="number" min={f.min} max={f.max} value={(s[f.key] as number)??f.default} onChange={e=>set(f.key,Number(e.target.value))} style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 12px",color:"#fff",fontSize:12,fontWeight:500,outline:"none",boxSizing:"border-box"}}/>}
            {f.type==="select"&&<select value={(s[f.key] as string)??f.default} onChange={e=>set(f.key,e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 10px",color:"#fff",fontSize:12,fontWeight:500,outline:"none",boxSizing:"border-box",cursor:"pointer"}}>{f.options.map(o=><option key={o.value} value={o.value} style={{background:"#141414"}}>{o.label}</option>)}</select>}
            {f.type==="toggle"&&(
              <button onClick={()=>set(f.key,!(s[f.key]??f.default))} style={{width:42,height:22,borderRadius:12,cursor:"pointer",background:(s[f.key]??f.default)?def.color:"rgba(255,255,255,0.08)",border:"none",position:"relative",transition:"all 0.3s ease",flexShrink:0,boxShadow:(s[f.key]??f.default)?`0 0 12px ${def.color}40`:"none"}}>
                <div style={{position:"absolute",top:3,left:(s[f.key]??f.default)?23:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",boxShadow:"0 2px 4px rgba(0,0,0,0.2)"}}/>
              </button>
            )}
            {f.type==="multiselect"&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {f.options.map(o=>{
                  const arr=(s[f.key] as string[])||f.default;
                  const on=arr.includes(o.value);
                  return <button key={o.value} onClick={()=>toggleMulti(f.key,o.value)} style={{padding:"4px 12px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",background:on?def.bg:"rgba(255,255,255,0.03)",border:`1px solid ${on?def.border:"rgba(255,255,255,0.06)"}`,color:on?def.color:"rgba(255,255,255,0.35)",transition:"all 0.2s"}}>{o.label}</button>;
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{padding:"18px 20px",borderTop:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.01)"}}>
        <button onClick={onDelete} style={{width:"100%",padding:"10px",borderRadius:10,border:"1px solid rgba(239,68,68,0.15)",background:"rgba(239,68,68,0.04)",color:"#ef4444",fontSize:12,fontWeight:800,cursor:"pointer",transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(239,68,68,0.08)";e.currentTarget.style.borderColor="rgba(239,68,68,0.3)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(239,68,68,0.04)";e.currentTarget.style.borderColor="rgba(239,68,68,0.15)";}}>DELETE MODULE</button>
      </div>
    </div>
  );
}

// ─── Module Node ──────────────────────────────────────────────────────────────
function ModuleNode({mod,selected,connecting,onMouseDown,onPortOut,onPortIn,status,isExecuting}:{
  mod:WModule;selected:boolean;connecting:string|null;
  onMouseDown:(e:React.MouseEvent)=>void;
  onPortOut:(e:React.MouseEvent,id:string)=>void;
  onPortIn:(e:React.MouseEvent,id:string)=>void;
  status?:"pending"|"running"|"success"|"error";
  isExecuting?:boolean;
}){
  const def=DEFS[mod.type];
  const canReceive=connecting&&connecting!==mod.id&&def.hasIn;
  const isRunning = status === "running";
  const isSuccess = status === "success";
  const isError = status === "error";
  return (
    <div
      onMouseDown={onMouseDown}
      onClick={e=>e.stopPropagation()}
      style={{
        position:"absolute",left:mod.x,top:mod.y,width:MOD_SIZE,height:MOD_SIZE,
        cursor:"grab",userSelect:"none",zIndex:selected?10:5,
        display:"flex",alignItems:"center",justifyContent:"center",
        flexDirection:"column"
      }}
    >
      {/* The Glow Aura (Dynamic) */}
      <div style={{
        position:"absolute",inset:-20,borderRadius:"50%",
        background:`radial-gradient(circle, ${def.color}25 0%, transparent 70%)`,
        opacity:isExecuting?1:selected?1:0.3,
        transition:"all 0.4s ease",
        animation:isExecuting?"blinkGlow 1s ease-in-out infinite":"none"
      }}/>

      {/* Main Glass Sphere Body */}
      <div style={{
        width:MOD_SIZE,height:MOD_SIZE,borderRadius:"50%",
        background: selected
          ? `linear-gradient(135deg, ${def.color}, ${def.color}dd)`
          : isError ? "rgba(239,68,68,0.1)"
          : isSuccess ? "rgba(34,197,94,0.1)"
          : isRunning ? "rgba(59,130,246,0.1)"
          : "rgba(25,25,25,0.85)",
        backdropFilter: "blur(16px)",
        border: `3.5px solid ${
          isError ? "#ef4444"
          : isSuccess ? "#22c55e"
          : isRunning ? "#3b82f6"
          : selected ? "#fff" : "rgba(255,255,255,0.12)"
        }`,
        boxShadow:
          isError ? "0 0 20px rgba(239,68,68,0.4), inset 0 0 15px rgba(255,255,255,0.05)"
          : isSuccess ? "0 0 20px rgba(34,197,94,0.4), inset 0 0 15px rgba(255,255,255,0.05)"
          : isRunning ? "0 0 20px rgba(59,130,246,0.4), inset 0 0 15px rgba(255,255,255,0.05)"
          : selected
          ? `0 25px 50px ${def.color}50, inset 0 0 25px rgba(255,255,255,0.45)`
          : "0 10px 40px rgba(0,0,0,0.6), inset 0 0 15px rgba(255,255,255,0.05)",
        display:"flex",alignItems:"center",justifyContent:"center",
        position:"relative",zIndex:2,
        transition:"all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        transform: isRunning ? "scale(1.08)" : selected ? "scale(1.05)" : "scale(1)",
        animation: isRunning ? "pulse 2s ease-in-out infinite" : "none"
      }}>
        {<def.icon size={Math.floor(MOD_SIZE*0.45)} color={selected ? "#fff" : def.color} style={{ opacity: selected?1:0.85, filter: selected ? "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" : "none" }} />}

        {/* Status Badge */}
        {status && (
          <div style={{
            position: "absolute",
            bottom: -8,
            right: -8,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: isError ? "#ef4444" : isSuccess ? "#22c55e" : isRunning ? "#3b82f6" : "rgba(255,255,255,0.1)",
            border: "3px solid rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: "bold",
            color: "#fff",
            zIndex: 10,
            animation: isRunning ? "pulse 1.5s ease-in-out infinite" : "none"
          }}>
            {isError && "✕"}
            {isSuccess && "✓"}
            {isRunning && "●"}
            {status === "pending" && "○"}
          </div>
        )}

        {/* Shine Refraction Overlay */}
        <div style={{
          position: "absolute", top: "10%", left: "20%", width: "40%", height: "20%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)",
          borderRadius: "50% 50% 40% 40%", pointerEvents: "none"
        }} />
      </div>

      {/* Label Title */}
      <div style={{
        position:"absolute",top:MOD_SIZE+14,left:"50%",transform:"translateX(-50%)",
        textAlign:"center",width:180,pointerEvents:"none"
      }}>
        <p style={{
          fontSize:12,fontWeight:900,color:"#fff",margin:0,
          letterSpacing:"-0.01em",textShadow:"0 2px 10px rgba(0,0,0,0.8)",
          opacity: selected ? 1 : 0.6
        }}>{def.label}</p>
        <p style={{ fontSize:9, color: "rgba(255,255,255,0.25)", margin:0, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>
          {mod.type.replace('-',' ')}
        </p>
      </div>

      {/* Input port */}
      {def.hasIn&&(
        <div 
          onMouseDown={e=>e.stopPropagation()}
          onMouseUp={e=>{e.stopPropagation();onPortIn(e,mod.id);}} 
          onClick={e=>e.stopPropagation()}
          style={{
            position:"absolute",left:-15,top:MOD_SIZE/2-PORT_R-10,width:PORT_R*2+20,height:PORT_R*2+20,
            borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
            cursor:"pointer",zIndex:20,transition:"all 0.15s",
          }}
        >
          <div style={{
            width:PORT_R*2,height:PORT_R*2,borderRadius:"50%",
            background:canReceive?def.color:"#1e1e1e",
            border:`2px solid ${canReceive?def.color:"rgba(255,255,255,0.3)"}`,
            boxShadow:canReceive?`0 0 12px ${def.color}`:"none"
          }}/>
        </div>
      )}
      {/* Output port */}
      {def.hasOut&&(
        <div 
          onMouseDown={e=>{e.stopPropagation();onPortOut(e,mod.id);}} 
          onMouseUp={e=>e.stopPropagation()}
          onClick={e=>e.stopPropagation()}
          style={{
            position:"absolute",right:-15,top:MOD_SIZE/2-PORT_R-10,width:PORT_R*2+20,height:PORT_R*2+20,
            borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
            cursor:"crosshair",zIndex:20,transition:"all 0.15s",
          }}
        >
          <div style={{
            width:PORT_R*2,height:PORT_R*2,borderRadius:"50%",
            background:connecting===mod.id?def.color:"#1e1e1e",
            border:`2px solid ${connecting===mod.id?def.color:"rgba(255,255,255,0.3)"}`,
            boxShadow:connecting===mod.id?`0 0 15px ${def.color}`:"none"
          }}/>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function BotLayoutPageInner(){
  const searchParams = useSearchParams();
  const editBotId = searchParams.get("botId");

  // All bots from DB
  const [allBots, setAllBots] = useState<BotEntry[]>([]);
  const [activeBotId, setActiveBotId] = useState<string|null>(null);
  const [botName, setBotName] = useState("Nový Bot");

  // Workflow state (canvas)
  const [modules, setModules] = useState<WModule[]>([]);
  const [connections, setConnections] = useState<WConn[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [connecting,setConnecting]=useState<string|null>(null);
  const [view,setView]=useState<View>({panX:40,panY:40,zoom:0.8});
  const [saved,setSaved]=useState(false);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState<{msg:string;type:"success"|"error"}|null>(null);

  const wrapRef=useRef<HTMLDivElement>(null);
  const dragRef=useRef<{id:string;startCx:number;startCy:number;startMx:number;startMy:number}|null>(null);
  const panRef=useRef<{startMx:number;startMy:number;startPx:number;startPy:number}|null>(null);
  const isPanning=useRef(false);
  const [ghostMouse,setGhostMouse]=useState({x:0,y:0});

  // Test run state
  const [testRunMode,setTestRunMode]=useState(false);
  const [testRunning,setTestRunning]=useState(false);
  const [executionLog,setExecutionLog]=useState<Array<{module:string;status:"pending"|"running"|"success"|"error";error?:string}>>([]);
  const [terminalLog,setTerminalLog]=useState<Array<{message:string;logType:"info"|"success"|"error"|"progress";timestamp:string}>>([]);
  const [testError,setTestError]=useState<{module:string;message:string}|null>(null);
  const [testArticleId,setTestArticleId]=useState<string|null>(null);
  const [currentExecutingModule,setCurrentExecutingModule]=useState<string|null>(null);
  const terminalEndRef=useRef<HTMLDivElement>(null);

  const selectedMod=modules.find(m=>m.id===selectedId)||null;

  const showToast = (msg:string, type:"success"|"error"="success") => {
    setToast({msg,type});
    setTimeout(()=>setToast(null),2500);
  };

  // ── Screen to Canvas coord conversion ──
  const s2c=useCallback((sx:number,sy:number):{x:number,y:number}=>{
    const rect=wrapRef.current!.getBoundingClientRect();
    return {x:(sx-rect.left-view.panX)/view.zoom, y:(sy-rect.top-view.panY)/view.zoom};
  },[view]);

  // ── Load all bots from Supabase ──
  useEffect(()=>{
    (async()=>{
      try {
        const { data } = await supabase.from("site_settings").select("value").eq("key","bots").single();
        let bots: BotEntry[] = [];
        if(data?.value){
          try{ bots = typeof data.value === "string" ? JSON.parse(data.value) : data.value; }catch{}
        }
        setAllBots(bots);

        // If URL has ?botId=xxx, load that bot
        const targetId = editBotId || (bots.length > 0 ? bots[0].id : null);
        if(targetId){
          const bot = bots.find(b=>b.id===targetId);
          if(bot){
            loadBotIntoCanvas(bot);
          } else if(bots.length > 0) {
            loadBotIntoCanvas(bots[0]);
          } else {
            createNewBot();
          }
        } else {
          createNewBot();
        }
      } catch {
        createNewBot();
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  function loadBotIntoCanvas(bot: BotEntry) {
    setActiveBotId(bot.id);
    setBotName(bot.name);
    if(bot.workflow){
      setModules(bot.workflow.modules);
      setConnections(bot.workflow.connections);
    } else {
      // Legacy bot without workflow — generate appropriate workflow from config
      const wf = generateWorkflowFromLegacyConfig(bot);
      setModules(wf.modules);
      setConnections(wf.connections);
    }
    setSelectedId(null);
    setConnecting(null);
  }

  function createNewBot() {
    const newId = botId();
    const newBot: BotEntry = {
      id: newId,
      name: "Nový Bot",
      enabled: false,
      type: "article_only",
      categories: ["AI"],
      last_run: null,
      processed_count: 0,
      workflow: { modules: [], connections: [] }
    };
    setAllBots(prev => [newBot, ...prev]);
    setActiveBotId(newId);
    setBotName(newBot.name);
    setModules([]);
    setConnections([]);
    setSelectedId(null);
    setConnecting(null);
  }

  function switchBot(id: string) {
    const bot = allBots.find(b=>b.id===id);
    if(bot) loadBotIntoCanvas(bot);
  }

  // ── Wheel zoom ──
  useEffect(()=>{
    const el=wrapRef.current;
    if(!el) return;
    const onWheel=(e:WheelEvent)=>{
      e.preventDefault();
      const rect=el.getBoundingClientRect();
      const mx=e.clientX-rect.left;
      const my=e.clientY-rect.top;
      const factor=e.deltaY<0?1.12:0.9;
      setView(v=>{
        const nz=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,v.zoom*factor));
        const r=nz/v.zoom;
        return{zoom:nz,panX:mx-r*(mx-v.panX),panY:my-r*(my-v.panY)};
      });
    };
    el.addEventListener("wheel",onWheel,{passive:false});
    return()=>el.removeEventListener("wheel",onWheel);
  },[]);

  // ── Test run bot ──
  async function runTest(){
    if(!activeBotId || modules.length === 0) {
      showToast("Pridaj moduly pre test");
      return;
    }

    setTestRunning(true);
    setTestError(null);
    setTestArticleId(null);
    setTerminalLog([]);
    setExecutionLog(modules.map(m => ({module: m.type, status: "pending" as const})));

    try {
      setTerminalLog([]);
      setCurrentExecutingModule(null);

      const wf: BotWorkflow = {modules, connections};
      const derived = deriveConfigFromWorkflow(wf);
      const bot: BotConfig = {
        id: activeBotId,
        name: botName,
        type: "full",
        enabled: true,
        ...derived,
        workflow: wf,
      };

      const response = await fetch("/api/admin/test-workflow", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({bot}),
      });

      if(!response.ok) {
        setTestError({module: "unknown", message: "Failed to start test"});
        setTestRunning(false);
        return;
      }

      const reader = response.body?.getReader();
      if(!reader) {
        setTestError({module: "unknown", message: "No response stream"});
        setTestRunning(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while(true) {
        const {done, value} = await reader.read();
        if(done) break;

        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for(const line of lines) {
          if(line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              // Log message
              if(data.type === "log") {
                setTerminalLog(prev => [...prev, {
                  message: data.message,
                  logType: data.logType,
                  timestamp: data.timestamp
                }]);
              }
              // Status update
              else if(data.type === "status") {
                if(data.status === "module_running") {
                  setCurrentExecutingModule(data.currentModule || null);
                } else if(data.status === "article_created" || data.status === "social_done") {
                  setTestArticleId(data.articleId || null);
                } else if(data.status === "completed") {
                  setTestArticleId(data.articleId || null);
                  setTestRunning(false);
                  setCurrentExecutingModule(null);
                } else if(data.status === "error") {
                  setTestRunning(false);
                  setCurrentExecutingModule(null);
                }
              }
              // Error
              else if(data.type === "error") {
                setTestError({module: "unknown", message: data.message});
                setTestRunning(false);
              }
            } catch(e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch(err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestError({module: "unknown", message: msg});
      setTestRunning(false);
    }
  }

  // Auto-scroll terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({behavior: "smooth"});
  }, [terminalLog]);

  // ── Save current bot ──
  async function save() {
    setLoading(true);
    try {
      const wf: BotWorkflow = { modules, connections };
      const derived = deriveConfigFromWorkflow(wf);

      // We need to update allBots and then save the WHOLE list to Supabase
      const newAllBots = [...allBots];
      const existingIdx = newAllBots.findIndex(b => b.id === activeBotId);

      const botToSave: BotEntry = {
        id: activeBotId!,
        name: botName,
        last_run: existingIdx >= 0 ? newAllBots[existingIdx].last_run : null,
        processed_count: existingIdx >= 0 ? newAllBots[existingIdx].processed_count : 0,
        last_category: existingIdx >= 0 ? newAllBots[existingIdx].last_category : undefined,
        ...derived,   // includes enabled, schedule_hours, interval_hours from trigger module
        workflow: wf,
      };

      if (existingIdx >= 0) {
        newAllBots[existingIdx] = { ...newAllBots[existingIdx], ...botToSave };
      } else {
        newAllBots.push(botToSave);
      }

      setAllBots(newAllBots);

      // 1. Save main bots list
      const { error: err1 } = await supabase.from("site_settings").upsert(
        { key: "bots", value: JSON.stringify(newAllBots) },
        { onConflict: "key" }
      );

      if (err1) throw err1;

      // 2. Legacy / Autopilot sync
      // If this is a full bot, or we want it to be the primary one
      const fullBot = newAllBots.find(b => b.type === "full" && b.enabled) || newAllBots.find(b => b.type === "full") || botToSave;
      if (fullBot) {
        await supabase.from("site_settings").upsert(
          { key: "ai_content_bot", value: JSON.stringify(fullBot) },
          { onConflict: "key" }
        );
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      showToast("Bot úspešne zverejnený!");
    } catch (err) {
      console.error("Save error:", err);
      showToast("Chyba pri ukladaní", "error");
    } finally {
      setLoading(false);
    }
  }

  // ── Delete current bot ──
  async function deleteCurrentBot() {
    if(!activeBotId) return;
    const updatedBots = allBots.filter(b => b.id !== activeBotId);
    setAllBots(updatedBots);
    await supabase.from("site_settings").upsert(
      {key:"bots", value: JSON.stringify(updatedBots)},
      {onConflict:"key"}
    );
    if(updatedBots.length > 0) {
      loadBotIntoCanvas(updatedBots[0]);
    } else {
      createNewBot();
    }
    showToast("Bot vymazaný");
  }

  // ── Add module ──
  function addModule(type:MType, x?:number, y?:number){
    const cx = x !== undefined ? x - MOD_SIZE/2 : (CANVAS_W/2)+(Math.random()-.5)*200;
    const cy = y !== undefined ? y - MOD_SIZE/2 : (CANVAS_H/2)+(Math.random()-.5)*100;
    const mod:WModule={id:uid(),type,x:cx,y:cy,settings:{...DEFS[type].defaults}};
    setModules(prev=>[...prev,mod]);
    setSelectedId(mod.id);
  }

  // ── Drag & Drop handlers ──
  function handleDragStart(e:React.DragEvent, type:MType){
    e.dataTransfer.setData("application/bot-module", type);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(e:React.DragEvent){
    e.preventDefault();
    const type = e.dataTransfer.getData("application/bot-module") as MType;
    if(!type || !DEFS[type]) return;
    
    // Get drop position relative to canvas coordinate system
    const cp = s2c(e.clientX, e.clientY);
    addModule(type, cp.x, cp.y);
  }

  // ── Canvas interactions ──
  function wrapMouseDown(e:React.MouseEvent<HTMLDivElement>){
    isPanning.current=true;
    panRef.current={startMx:e.clientX,startMy:e.clientY,startPx:view.panX,startPy:view.panY};
    setSelectedId(null);
    setConnecting(null);
    e.preventDefault();
  }

  function wrapMouseMove(e:React.MouseEvent<HTMLDivElement>){
    const cp=s2c(e.clientX,e.clientY);
    setGhostMouse({...cp});

    if(dragRef.current){
      const dx=cp.x-dragRef.current.startCx;
      const dy=cp.y-dragRef.current.startCy;
      const nx=dragRef.current.startMx+dx;
      const ny=dragRef.current.startMy+dy;
      setModules(prev=>prev.map(m=>m.id===dragRef.current!.id?{...m,x:nx,y:ny}:m));
    } else if(isPanning.current&&panRef.current){
      const dx=e.clientX-panRef.current.startMx;
      const dy=e.clientY-panRef.current.startMy;
      const nx = panRef.current!.startPx+dx;
      const ny = panRef.current!.startPy+dy;
      setView(v=>({...v,panX:nx,panY:ny}));
    }
  }

  function wrapMouseUp(){
    dragRef.current=null;
    isPanning.current=false;
    panRef.current=null;
    // Clear connecting if mouse up on the canvas (drag-to-connect failed)
    setConnecting(null);
  }

  function startDrag(e:React.MouseEvent,mod:WModule){
    e.stopPropagation();
    e.preventDefault();
    const cp=s2c(e.clientX,e.clientY);
    dragRef.current={id:mod.id,startCx:cp.x,startCy:cp.y,startMx:mod.x,startMy:mod.y};
    setSelectedId(mod.id);
  }

  function portOut(e:React.MouseEvent,modId:string){
    e.stopPropagation();
    setConnecting(prev=>prev===modId?null:modId);
  }
  function portIn(e:React.MouseEvent,modId:string){
    e.stopPropagation();
    if(!connecting||connecting===modId) return;
    if(!connections.some(c=>c.fromId===connecting&&c.toId===modId)){
      setConnections(prev=>[...prev,{id:cuid(),fromId:connecting,toId:modId}]);
    }
    setConnecting(null);
  }

  function delConn(id:string){setConnections(prev=>prev.filter(c=>c.id!==id));}
  function delMod(id:string){
    setModules(prev=>prev.filter(m=>m.id!==id));
    setConnections(prev=>prev.filter(c=>c.fromId!==id&&c.toId!==id));
    setSelectedId(null);
  }
  function updSettings(id:string,settings:Record<string,unknown>){
    setModules(prev=>prev.map(m=>m.id===id?{...m,settings}:m));
  }

  // ── Zoom controls ──
  function zoomTo(factor:number){
    setView(v=>{
      const nz=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,v.zoom*factor));
      const r=nz/v.zoom;
      const cx=(wrapRef.current?.clientWidth||800)/2;
      const cy=(wrapRef.current?.clientHeight||600)/2;
      return{zoom:nz,panX:cx-r*(cx-v.panX),panY:cy-r*(cy-v.panY)};
    });
  }

  function fitView(){
    if(modules.length===0) return;
    const minX=Math.min(...modules.map(m=>m.x))-40;
    const minY=Math.min(...modules.map(m=>m.y))-40;
    const maxX=Math.max(...modules.map(m=>m.x+MOD_SIZE))+40;
    const maxY=Math.max(...modules.map(m=>m.y+MOD_SIZE))+40;
    const cw=wrapRef.current?.clientWidth||800;
    const ch=wrapRef.current?.clientHeight||600;
    const z=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,Math.min(cw/(maxX-minX),ch/(maxY-minY))*0.9));
    setView({zoom:z,panX:(cw-(maxX-minX)*z)/2-minX*z,panY:(ch-(maxY-minY)*z)/2-minY*z});
  }

  // ── Ghost connection ──
  const conMod=connecting?modules.find(m=>m.id===connecting):null;
  const ghostPath=conMod?bezier(outPt(conMod).x,outPt(conMod).y,ghostMouse.x,ghostMouse.y):null;

  const cursorStyle=isPanning.current?"grabbing":connecting?"crosshair":"default";

  // Is this bot already saved?
  const isExistingBot = allBots.some(b => b.id === activeBotId);

  if(loading) {
    return (
      <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080808"}}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{width:36,height:36,border:"2px solid rgba(139,92,246,0.2)",borderTopColor:"#8b5cf6",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      </div>
    );
  }

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#080808",color:"#fff",overflow:"hidden"}}>
      <style>{`
        @keyframes slideIn{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes flow{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes blinkGlow{0%,100%{opacity:1;filter:drop-shadow(0 0 20px currentColor)}50%{opacity:0.6;filter:drop-shadow(0 0 30px currentColor)}}
        select option{background:#141414}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
      `}</style>

      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",alignItems:"center",gap:10,background:toast.type==="success"?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)",border:`1px solid ${toast.type==="success"?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`,backdropFilter:"blur(12px)",borderRadius:12,padding:"12px 18px",color:"#fff",fontSize:13,fontWeight:500,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:toast.type==="success"?"#22c55e":"#ef4444"}}/>
          {toast.msg}
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div style={{height:55,flexShrink:0,display:"flex",alignItems:"center",gap:10,padding:"0 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(10,10,10,0.8)",backdropFilter:"blur(20px)",zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <h1 style={{fontSize:13,fontWeight:800,letterSpacing:"-0.01em",margin:0,color:"#fff"}}>Bot Layout</h1>
        </div>
        
        <div style={{width:1,height:24,background:"rgba(255,255,255,0.08)",margin:"0 10px"}}/>

        {/* Bot name input */}
        <input value={botName} onChange={e=>setBotName(e.target.value)}
          style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"6px 12px",color:"#fff",fontSize:12,fontWeight:600,outline:"none",width:180,transition:"all 0.2s"}}
          onFocus={e=>e.currentTarget.style.borderColor="rgba(139,92,246,0.5)"}
          onBlur={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.1)"}
        />

        {/* Schedule indicator — driven by AI Autopilot settings */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:8,padding:"4px 10px",background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.15)",borderRadius:7}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",opacity:0.8}}/>
          <span style={{fontSize:10,color:"rgba(34,197,94,0.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Časovanie cez Autopilot</span>
        </div>

        <div style={{flex:1}}/>

        {/* Zoom controls */}
        <div style={{display:"flex",alignItems:"center",gap:2,background:"rgba(0,0,0,0.3)",borderRadius:10,padding:"3px",border:"1px solid rgba(255,255,255,0.06)"}}>
          <button onClick={()=>zoomTo(0.85)} style={{width:28,height:24,background:"none",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
          <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",minWidth:36,textAlign:"center"}}>{Math.round(view.zoom*100)}%</span>
          <button onClick={()=>zoomTo(1.18)} style={{width:28,height:24,background:"none",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
        </div>
        
        <button onClick={fitView} style={{marginLeft:6,padding:"6px 12px",borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.6)",fontSize:11,cursor:"pointer",fontWeight:700,transition:"all 0.2s"}}>Symmetry</button>

        {connecting&&(
          <button onClick={()=>setConnecting(null)} style={{padding:"6px 14px",borderRadius:8,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",color:"#ef4444",fontSize:11,fontWeight:800,cursor:"pointer",marginLeft:10}}>✕ Zrušiť</button>
        )}

        {/* Test Run button */}
        <button onClick={()=>{setTestRunMode(true);runTest();}} style={{marginLeft:10,padding:"8px 16px",borderRadius:8,background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.25)",color:"#22c55e",fontSize:12,fontWeight:700,cursor:"pointer"}}>▶ Test Run</button>

        {/* Delete bot button */}
        {isExistingBot&&(
          <button onClick={deleteCurrentBot} style={{marginLeft:10,padding:"6px 12px",borderRadius:7,background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.15)",color:"#ef4444",fontSize:12,cursor:"pointer",transition:"all 0.2s"}}>🗑</button>
        )}

        <button onClick={save} style={{marginLeft:10,padding:"8px 18px",borderRadius:10,background:saved?"rgba(34,197,94,0.15)":"linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",border:`1px solid ${saved?"rgba(34,197,94,0.3)":"rgba(139,92,246,0.3)"}`,color:saved?"#22c55e":"#fff",fontSize:12,fontWeight:800,cursor:"pointer",transition:"all 0.3s",boxShadow:saved?"none":"0 4px 15px rgba(139,92,246,0.3)"}}>
          {saved?"✓ SUCCESS":"PUBLISH BOT"}
        </button>
      </div>

      {/* ── BODY ── */}
      <div style={{flex:1,display:"flex",overflow:"hidden",background:"#080808"}}>

        {/* ── LEFT SIDEBAR: Bot List + Palette ── */}
        <div style={{width:230,flexShrink:0,background:"rgba(13,13,13,0.5)",borderRight:"1px solid rgba(255,255,255,0.06)",overflowY:"auto",display:"flex",flexDirection:"column",backdropFilter:"blur(10px)"}}>

          {/* Bot List Section */}
          <div style={{padding:"16px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <p style={{fontSize:9,fontWeight:900,letterSpacing:"0.15em",color:"rgba(255,255,255,0.25)",textTransform:"uppercase",margin:0}}>Workspace Projects</p>
              <button onClick={createNewBot}
                style={{
                  width:24,height:24,borderRadius:6,background:"rgba(139,92,246,0.15)",border:"1px solid rgba(139,92,246,0.3)",
                  color:"#a78bfa",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                  transition:"all 0.2s"
                }}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(139,92,246,0.25)";e.currentTarget.style.transform="scale(1.1)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(139,92,246,0.15)";e.currentTarget.style.transform="scale(1)";}}
              >
                <Plus size={14} />
              </button>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {allBots.length === 0 && (
                <p style={{fontSize:10,color:"rgba(255,255,255,0.15)",padding:"8px",textAlign:"center",border:"1px dashed rgba(255,255,255,0.05)",borderRadius:8}}>Create automation</p>
              )}

              {allBots.map(bot=>{
                const isActive = bot.id === activeBotId;
                const typeColor = bot.type === "full" ? "#a78bfa" : "#f59e0b";
                return (
                  <button key={bot.id} onClick={()=>switchBot(bot.id)}
                    style={{
                      width:"100%",textAlign:"left",padding:"10px 12px",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"all 0.2s",
                      background:isActive?"rgba(139,92,246,0.1)":"transparent",
                      border:`1px solid ${isActive?"rgba(139,92,246,0.2)":"transparent"}`,
                    }}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:bot.enabled?"#22c55e":"rgba(255,255,255,0.1)",boxShadow:bot.enabled?"0 0 10px #22c55e60":"none",flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:11,fontWeight:isActive?700:600,color:isActive?"#fff":"rgba(255,255,255,0.5)",margin:0,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{bot.name}</p>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                        <span style={{fontSize:8,color:typeColor,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.05em"}}>{bot.type}</span>
                        <span style={{fontSize:8,color:"rgba(255,255,255,0.15)",fontWeight:600}}>{bot.workflow?.modules?.length || 0} nodes</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module Palette */}
          <div style={{flex:1,padding:"16px 12px",overflowY:"auto"}}>
            <p style={{fontSize:9,fontWeight:900,letterSpacing:"0.15em",color:"rgba(255,255,255,0.25)",textTransform:"uppercase",marginBottom:12}}>Logic Nodes</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:6}}>
              {PALETTE.map(type=>{
                const d=DEFS[type];
                return (
                  <button key={type} 
                    onClick={() => addModule(type)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, type)}
                    style={{
                      width:"100%",textAlign:"left",padding:"8px 10px",borderRadius:10,cursor:"grab",
                      background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
                      display:"flex",alignItems:"center",gap:10,transition:"all 0.2s"
                    }}
                    onMouseEnter={e=>{
                      const el = e.currentTarget;
                      el.style.background = d.bg;
                      el.style.borderColor = d.border;
                      el.style.transform = "translateX(5px)";
                    }}
                    onMouseLeave={e=>{
                      const el = e.currentTarget;
                      el.style.background = "rgba(255,255,255,0.03)";
                      el.style.borderColor = "rgba(255,255,255,0.06)";
                      el.style.transform = "translateX(0)";
                    }}
                  >
                    <div style={{width:24,height:24,borderRadius:7,background:d.bg,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${d.border}`}}>
                      <d.icon size={12} color={d.color} />
                    </div>
                    <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.6)",margin:0}}>{d.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── CANVAS WRAPPER ── */}
        <div
          ref={wrapRef}
          onMouseDown={wrapMouseDown}
          onMouseMove={wrapMouseMove}
          onMouseUp={wrapMouseUp}
          onMouseLeave={wrapMouseUp}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          style={{flex:1,overflow:"hidden",position:"relative",cursor:cursorStyle,paddingBottom:testRunning?200:0,transition:"padding-bottom 0.3s ease"}}
        >
          {/* Inner canvas — transformed */}
          <div style={{
            position:"absolute",top:0,left:0,width:CANVAS_W,height:CANVAS_H,
            transform:`translate(${view.panX}px,${view.panY}px) scale(${view.zoom})`,
            transformOrigin:"0 0",
            backgroundImage:"radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize:"28px 28px",
          }}>
            {/* SVG connections */}
            <svg style={{position:"absolute",inset:0,width:CANVAS_W,height:CANVAS_H,overflow:"visible",pointerEvents:"none",zIndex:2}}>
              <defs>
                <filter id="glow-con" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                {PALETTE.map(t=>(
                  <marker key={t} id={`a-${t}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L7,3 z" fill={DEFS[t].color} fillOpacity="0.85"/>
                  </marker>
                ))}
                <marker id="a-ghost" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L7,3 z" fill="rgba(255,255,255,0.4)"/>
                </marker>
              </defs>
              {connections.map(conn=>{
                const fm=modules.find(m=>m.id===conn.fromId);
                const tm=modules.find(m=>m.id===conn.toId);
                if(!fm||!tm) return null;
                const op=outPt(fm),ip=inPt(tm);
                const pathD = bezier(op.x,op.y,ip.x,ip.y);
                const color = DEFS[fm.type]?.color || "#666";
                return (
                  <g key={conn.id} style={{pointerEvents:"all"}}>
                    <path d={pathD} stroke="transparent" strokeWidth="12" fill="none" onClick={e=>{e.stopPropagation();delConn(conn.id);}} style={{cursor:"pointer"}}/>
                    <path d={pathD} stroke={color} strokeWidth="3" fill="none" strokeOpacity="0.4" filter="url(#glow-con)" />
                    <path d={pathD} stroke={color} strokeWidth="1.5" fill="none" strokeOpacity="1" markerEnd={`url(#a-${fm.type})`} />
                    
                    {/* Data Packet - only animate during test run */}
                    {testRunning && (
                      <circle r="4" fill="#fff" filter="url(#glow-con)">
                        <animateMotion
                          dur="3s"
                          repeatCount="indefinite"
                          path={pathD}
                          begin={`-${(parseInt(conn.id.replace(/\D/g,'') || '0') % 30) / 10}s`}
                        />
                      </circle>
                    )}
                  </g>
                );
              })}
              {ghostPath&&<path d={ghostPath} stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="7 4" fill="none" markerEnd="url(#a-ghost)"/>}
            </svg>

            {/* Module nodes */}
            {modules.map(mod=>{
              const modLog = executionLog.find(l => l.module === mod.type);
              const isCurrentlyExecuting = currentExecutingModule === mod.type;
              return (
                <ModuleNode key={mod.id} mod={mod} selected={selectedId===mod.id} connecting={connecting}
                  onMouseDown={e=>startDrag(e,mod)} onPortOut={portOut} onPortIn={portIn}
                  status={testRunning || modLog ? modLog?.status : undefined}
                  isExecuting={isCurrentlyExecuting}/>
              );
            })}

            {modules.length===0&&(
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}}>
                <p style={{fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.25)"}}>Pridaj moduly z ľavého panela</p>
              </div>
            )}
          </div>

          {/* HUD */}
          <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:99,padding:"5px 14px",fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:600,letterSpacing:"0.05em",pointerEvents:"none",whiteSpace:"nowrap"}}>
            🖱 Scroll = zoom · Drag pozadia = posun · Klik port → port = spoj · Klik spoj = zmaž
          </div>
          <div style={{position:"absolute",bottom:16,right:16,background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"4px 10px",fontSize:11,color:"rgba(255,255,255,0.35)",pointerEvents:"none"}}>
            {Math.round(view.zoom*100)}%
          </div>
        </div>

        {/* ── SETTINGS PANEL ── */}
        {selectedMod
          ? <SettingsPanel mod={selectedMod} onChange={s=>updSettings(selectedMod.id,s)} onClose={()=>setSelectedId(null)} onDelete={()=>delMod(selectedMod.id)}/>
          : (
            <div style={{width:230,flexShrink:0,background:"#0d0d0d",borderLeft:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,gap:8,textAlign:"center"}}>
              <span style={{fontSize:32,opacity:0.4}}>👆</span>
              <p style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.2)",lineHeight:1.5,margin:0}}>Klikni na modul pre nastavenia</p>
              <div style={{height:1,width:"80%",background:"rgba(255,255,255,0.05)",margin:"6px 0"}}/>
              <p style={{fontSize:10,color:"rgba(255,255,255,0.15)",lineHeight:1.5,margin:0}}>Klikni výstupný port (•) potom vstupný port iného modulu pre spojenie.</p>
              <p style={{fontSize:10,color:"rgba(255,255,255,0.12)",lineHeight:1.5,margin:0}}>Klikni na čiaru pre jej odstránenie.</p>
            </div>
          )
        }
      </div>

      {/* ── TERMINAL LOG PANEL (Compact Bottom Bar) ── */}
      {(testRunning || terminalLog.length > 0) && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,height:testRunning||terminalLog.length>3?200:80,background:"rgba(10,10,10,0.98)",borderTop:"1px solid rgba(255,255,255,0.08)",backdropFilter:"blur(12px)",zIndex:999,display:"flex",flexDirection:"column",transition:"height 0.3s ease"}}>
          {/* Header */}
          <div style={{padding:"8px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:40}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:testRunning?"#3b82f6":"#22c55e",animation:testRunning?"pulse 1s ease-in-out infinite":"none"}}/>
                <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.05em"}}>
                  {testRunning?"🔄 Running":"✅ Done"}
                </span>
              </div>
              {currentExecutingModule && (
                <span style={{fontSize:9,color:"#ec4899",fontWeight:600,padding:"2px 8px",background:"rgba(236,72,153,0.15)",borderRadius:4,animation:"blinkGlow 1s ease-in-out infinite"}}>
                  {DEFS[currentExecutingModule as MType]?.label || currentExecutingModule}
                </span>
              )}
              {testArticleId && (
                <span style={{fontSize:9,color:"#22c55e",marginLeft:8}}>
                  📄 ID: {testArticleId.substring(0,8)}...
                </span>
              )}
            </div>
            <button onClick={()=>{setTerminalLog([]);}} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:12,padding:"0 4px"}}>✕</button>
          </div>

          {/* Terminal content - scrollable */}
          {(testRunning || terminalLog.length > 3) && (
            <div style={{flex:1,overflowY:"auto",padding:"6px 16px",fontFamily:"'Courier New', monospace",fontSize:9,lineHeight:1.4,color:"rgba(255,255,255,0.7)"}}>
              {terminalLog.slice(-15).map((log,i)=>(
                <div key={i} style={{display:"flex",gap:10,marginBottom:2,color:
                  log.logType==="error"?"#ef4444":
                  log.logType==="success"?"#22c55e":
                  log.logType==="progress"?"#3b82f6":
                  "rgba(255,255,255,0.5)"
                }}>
                  <span style={{color:"rgba(255,255,255,0.15)",minWidth:30,flexShrink:0}}>{log.timestamp.split("T")[1]?.substring(0,8) || ""}</span>
                  <span style={{flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{log.message}</span>
                </div>
              ))}
              <div ref={terminalEndRef}/>
            </div>
          )}

          {/* Compact single-line view */}
          {!testRunning && terminalLog.length > 0 && terminalLog.length <= 3 && (
            <div style={{padding:"6px 16px",fontSize:9,color:"rgba(255,255,255,0.6)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {terminalLog[terminalLog.length-1]?.message}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default function BotLayoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080808" }} />}>
      <BotLayoutPageInner />
    </Suspense>
  );
}
