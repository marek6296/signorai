"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const MW = 240;
const MH = 88;
const PORT_R = 7;
const CANVAS_W = 5000;
const CANVAS_H = 4000;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.0;

// ─── Types ────────────────────────────────────────────────────────────────────
type MType = "trigger"|"topic-scout"|"article-writer"|"image-sourcer"|"ai-image-gen"|"publisher"|"social-poster"|"filter"|"delay";
interface WModule  { id:string; type:MType; x:number; y:number; settings:Record<string,unknown>; }
interface WConn    { id:string; fromId:string; toId:string; }
interface Workflow { name:string; modules:WModule[]; connections:WConn[]; }
interface View     { panX:number; panY:number; zoom:number; }
interface WFRecord { id:string; name:string; workflow:Workflow; enabled:boolean; last_run:string|null; run_count:number; updated_at?:string; created_at?:string; }

type FieldDef =
  | {key:string;label:string;type:"text";        default:string}
  | {key:string;label:string;type:"number";      default:number;min?:number;max?:number}
  | {key:string;label:string;type:"select";      options:{value:string;label:string}[];default:string}
  | {key:string;label:string;type:"toggle";      default:boolean}
  | {key:string;label:string;type:"multiselect"; options:{value:string;label:string}[];default:string[]};

interface MDef {
  label:string; desc:string; emoji:string;
  color:string; bg:string; border:string;
  hasIn:boolean; hasOut:boolean;
  defaults:Record<string,unknown>; fields:FieldDef[];
}

const DEFS: Record<MType, MDef> = {
  trigger:{label:"Spúšťač",desc:"Kedy sa workflow spustí",emoji:"⚡",color:"#22c55e",bg:"rgba(34,197,94,0.08)",border:"rgba(34,197,94,0.25)",hasIn:false,hasOut:true,
    defaults:{schedule:"0 * * * *",enabled:true},
    fields:[{key:"schedule",label:"Cron plán",type:"text",default:"0 * * * *"},{key:"enabled",label:"Aktívny",type:"toggle",default:true}]},
  "topic-scout":{label:"Prieskum Tém",desc:"Hľadá aktuálne témy cez Gemini",emoji:"🔍",color:"#3b82f6",bg:"rgba(59,130,246,0.08)",border:"rgba(59,130,246,0.25)",hasIn:true,hasOut:true,
    defaults:{categories:["AI"],timeRange:"48h",googleSearch:true,dedup:true},
    fields:[
      {key:"categories",label:"Kategórie",type:"multiselect",options:[{value:"AI",label:"AI"},{value:"Tech",label:"Tech"},{value:"Návody & Tipy",label:"Návody & Tipy"}],default:["AI"]},
      {key:"timeRange",label:"Rozsah",type:"select",options:[{value:"24h",label:"24h"},{value:"48h",label:"48h"},{value:"7d",label:"7 dní"}],default:"48h"},
      {key:"googleSearch",label:"Google Search",type:"toggle",default:true},
      {key:"dedup",label:"Preskočiť existujúce",type:"toggle",default:true}]},
  "article-writer":{label:"Písanie Článku",desc:"Generuje plný článok v SK",emoji:"✍️",color:"#8b5cf6",bg:"rgba(139,92,246,0.08)",border:"rgba(139,92,246,0.25)",hasIn:true,hasOut:true,
    defaults:{language:"sk",minWords:400,style:"journalistic",addSummary:true},
    fields:[
      {key:"language",label:"Jazyk",type:"select",options:[{value:"sk",label:"Slovenčina"},{value:"en",label:"English"},{value:"cs",label:"Čeština"}],default:"sk"},
      {key:"minWords",label:"Min. slov",type:"number",default:400,min:200,max:2000},
      {key:"style",label:"Štýl",type:"select",options:[{value:"journalistic",label:"Žurnalistický"},{value:"casual",label:"Neformálny"},{value:"technical",label:"Technický"}],default:"journalistic"},
      {key:"addSummary",label:"AI Zhrnutie (audio)",type:"toggle",default:true}]},
  "image-sourcer":{label:"Scraping Obrázkov",desc:"Berie obrázky zo zdrojového URL",emoji:"🔗",color:"#f59e0b",bg:"rgba(245,158,11,0.08)",border:"rgba(245,158,11,0.25)",hasIn:true,hasOut:true,
    defaults:{tryOg:true,tryArticle:true},
    fields:[{key:"tryOg",label:"OG Image",type:"toggle",default:true},{key:"tryArticle",label:"Obrázky z článku",type:"toggle",default:true}]},
  "ai-image-gen":{label:"AI Generátor Obrázkov",desc:"Gemini generuje chýbajúce obrázky",emoji:"✨",color:"#ec4899",bg:"rgba(236,72,153,0.08)",border:"rgba(236,72,153,0.25)",hasIn:true,hasOut:true,
    defaults:{model:"gemini",count:3,style:"editorial",smartPrompts:true},
    fields:[
      {key:"model",label:"Model",type:"select",options:[{value:"gemini",label:"Gemini Imagen"},{value:"dalle",label:"DALL-E 3"}],default:"gemini"},
      {key:"count",label:"Max obrázkov",type:"number",default:3,min:1,max:5},
      {key:"style",label:"Štýl",type:"select",options:[{value:"editorial",label:"Editoriál (Wired)"},{value:"documentary",label:"Dokumentárny"},{value:"product",label:"Produktový"}],default:"editorial"},
      {key:"smartPrompts",label:"Smart prompts (Gemini analyzuje sekcie)",type:"toggle",default:true}]},
  publisher:{label:"Publikovanie",desc:"Uloží a zverejní článok na webe",emoji:"🚀",color:"#06b6d4",bg:"rgba(6,182,212,0.08)",border:"rgba(6,182,212,0.25)",hasIn:true,hasOut:true,
    defaults:{status:"published",revalidate:true},
    fields:[
      {key:"status",label:"Stav",type:"select",options:[{value:"published",label:"Publikovaný"},{value:"draft",label:"Koncept"}],default:"published"},
      {key:"revalidate",label:"Revalidovať cache",type:"toggle",default:true}]},
  "social-poster":{label:"Sociálne Siete",desc:"Postuje na Instagram & Facebook",emoji:"📢",color:"#d946ef",bg:"rgba(217,70,239,0.08)",border:"rgba(217,70,239,0.25)",hasIn:true,hasOut:false,
    defaults:{platforms:["Instagram"],imageFormat:"photo",autoPublish:true},
    fields:[
      {key:"platforms",label:"Platformy",type:"multiselect",options:[{value:"Instagram",label:"Instagram"},{value:"Facebook",label:"Facebook"}],default:["Instagram"]},
      {key:"imageFormat",label:"Formát obrázka",type:"select",options:[{value:"photo",label:"🖼 Foto z článku"},{value:"studio",label:"⬛ Studio"},{value:"article_bg",label:"🌅 Foto pozadie"}],default:"photo"},
      {key:"autoPublish",label:"Auto publikovanie",type:"toggle",default:true}]},
  filter:{label:"Filter / Podmienka",desc:"Pokračuje len ak je podmienka splnená",emoji:"🔀",color:"#6b7280",bg:"rgba(107,114,128,0.08)",border:"rgba(107,114,128,0.25)",hasIn:true,hasOut:true,
    defaults:{field:"category",operator:"equals",value:"AI"},
    fields:[
      {key:"field",label:"Pole",type:"select",options:[{value:"category",label:"Kategória"},{value:"hasUrl",label:"Má URL"},{value:"hasImages",label:"Má obrázky"}],default:"category"},
      {key:"operator",label:"Operátor",type:"select",options:[{value:"equals",label:"rovná sa"},{value:"not_equals",label:"nerovná sa"},{value:"contains",label:"obsahuje"}],default:"equals"},
      {key:"value",label:"Hodnota",type:"text",default:"AI"}]},
  delay:{label:"Pauza / Čakanie",desc:"Čaká určitý čas pred ďalším krokom",emoji:"⏳",color:"#94a3b8",bg:"rgba(148,163,184,0.08)",border:"rgba(148,163,184,0.25)",hasIn:true,hasOut:true,
    defaults:{seconds:60},
    fields:[{key:"seconds",label:"Sekúnd čakania",type:"number",default:60,min:1,max:3600}]},
};

const PALETTE: MType[] = ["trigger","topic-scout","article-writer","image-sourcer","ai-image-gen","publisher","social-poster","filter","delay"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid()  { return `m_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }
function wfid() { return `wf_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }
function cuid() { return `c_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }
function bezier(x1:number,y1:number,x2:number,y2:number){
  const d=Math.abs(x2-x1)*0.55;
  return `M${x1},${y1} C${x1+d},${y1} ${x2-d},${y2} ${x2},${y2}`;
}
function outPt(m:WModule){return{x:m.x+MW,  y:m.y+MH/2};}
function inPt(m:WModule) {return{x:m.x,     y:m.y+MH/2};}

function defaultWF(name?:string): Workflow {
  const t  = {id:uid(),type:"trigger"        as MType,x:120, y:300,settings:{...DEFS["trigger"].defaults}};
  const s  = {id:uid(),type:"topic-scout"    as MType,x:440, y:300,settings:{...DEFS["topic-scout"].defaults}};
  const a  = {id:uid(),type:"article-writer" as MType,x:760, y:220,settings:{...DEFS["article-writer"].defaults}};
  const im = {id:uid(),type:"image-sourcer"  as MType,x:760, y:380,settings:{...DEFS["image-sourcer"].defaults}};
  const g  = {id:uid(),type:"ai-image-gen"   as MType,x:1080,y:300,settings:{...DEFS["ai-image-gen"].defaults}};
  const p  = {id:uid(),type:"publisher"      as MType,x:1400,y:300,settings:{...DEFS["publisher"].defaults}};
  const so = {id:uid(),type:"social-poster"  as MType,x:1720,y:300,settings:{...DEFS["social-poster"].defaults}};
  return {
    name: name||"Hlavný Bot Workflow",
    modules:[t,s,a,im,g,p,so],
    connections:[
      {id:cuid(),fromId:t.id, toId:s.id},
      {id:cuid(),fromId:s.id, toId:a.id},
      {id:cuid(),fromId:s.id, toId:im.id},
      {id:cuid(),fromId:a.id, toId:g.id},
      {id:cuid(),fromId:im.id,toId:g.id},
      {id:cuid(),fromId:g.id, toId:p.id},
      {id:cuid(),fromId:p.id, toId:so.id},
    ],
  };
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({mod,onChange,onClose,onDelete}:{
  mod:WModule; onChange:(s:Record<string,unknown>)=>void; onClose:()=>void; onDelete:()=>void;
}){
  const def=DEFS[mod.type];
  const s=mod.settings;
  function set(key:string,val:unknown){onChange({...s,[key]:val});}
  function toggleMulti(key:string,val:string){
    const arr=(s[key] as string[])||[];
    set(key,arr.includes(val)?arr.filter(x=>x!==val):[...arr,val]);
  }
  return (
    <div style={{width:272,flexShrink:0,background:"#0c0c0c",borderLeft:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",overflow:"hidden",animation:"slideIn 0.2s ease"}}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:30,height:30,borderRadius:8,background:def.bg,border:`1px solid ${def.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>{def.emoji}</div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:12,fontWeight:700,color:"#fff",margin:0}}>{def.label}</p>
          <p style={{fontSize:10,color:"rgba(255,255,255,0.3)",margin:0}}>{def.desc}</p>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.25)",cursor:"pointer",fontSize:15,lineHeight:1,padding:4}}>✕</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 18px",display:"flex",flexDirection:"column",gap:12}}>
        {def.fields.map(f=>(
          <div key={f.key}>
            <label style={{display:"block",fontSize:9,fontWeight:800,color:"rgba(255,255,255,0.35)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>{f.label}</label>
            {f.type==="text"&&<input value={(s[f.key] as string)??f.default} onChange={e=>set(f.key,e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,padding:"7px 10px",color:"#fff",fontSize:12,outline:"none",boxSizing:"border-box"}}/>}
            {f.type==="number"&&<input type="number" min={f.min} max={f.max} value={(s[f.key] as number)??f.default} onChange={e=>set(f.key,Number(e.target.value))} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,padding:"7px 10px",color:"#fff",fontSize:12,outline:"none",boxSizing:"border-box"}}/>}
            {f.type==="select"&&<select value={(s[f.key] as string)??f.default} onChange={e=>set(f.key,e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,padding:"7px 10px",color:"#fff",fontSize:12,outline:"none",boxSizing:"border-box"}}>{f.options.map(o=><option key={o.value} value={o.value} style={{background:"#141414"}}>{o.label}</option>)}</select>}
            {f.type==="toggle"&&(
              <button onClick={()=>set(f.key,!(s[f.key]??f.default))} style={{width:38,height:20,borderRadius:10,cursor:"pointer",background:(s[f.key]??f.default)?def.color:"rgba(255,255,255,0.08)",border:"none",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                <div style={{position:"absolute",top:2,left:(s[f.key]??f.default)?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </button>
            )}
            {f.type==="multiselect"&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {f.options.map(o=>{
                  const arr=(s[f.key] as string[])||f.default;
                  const on=arr.includes(o.value);
                  return <button key={o.value} onClick={()=>toggleMulti(f.key,o.value)} style={{padding:"3px 9px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",background:on?def.bg:"rgba(255,255,255,0.04)",border:`1px solid ${on?def.border:"rgba(255,255,255,0.07)"}`,color:on?def.color:"rgba(255,255,255,0.4)",transition:"all 0.15s"}}>{o.label}</button>;
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{padding:"12px 18px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <button onClick={onDelete} style={{width:"100%",padding:"8px",borderRadius:8,border:"1px solid rgba(239,68,68,0.2)",background:"rgba(239,68,68,0.06)",color:"#ef4444",fontSize:12,fontWeight:600,cursor:"pointer"}}>Odstrániť modul</button>
      </div>
    </div>
  );
}

// ─── Module Node ──────────────────────────────────────────────────────────────
function ModuleNode({mod,selected,connecting,onMouseDown,onPortOut,onPortIn}:{
  mod:WModule; selected:boolean; connecting:string|null;
  onMouseDown:(e:React.MouseEvent)=>void;
  onPortOut:(e:React.MouseEvent,id:string)=>void;
  onPortIn:(e:React.MouseEvent,id:string)=>void;
}){
  const def=DEFS[mod.type];
  const canReceive=connecting&&connecting!==mod.id&&def.hasIn;
  return (
    <div
      onMouseDown={onMouseDown}
      onClick={e=>e.stopPropagation()}
      style={{position:"absolute",left:mod.x,top:mod.y,width:MW,height:MH,background:"#141414",borderRadius:14,
        cursor:"grab",userSelect:"none",zIndex:selected?10:5,
        border:`1px solid ${selected?def.color:"rgba(255,255,255,0.08)"}`,
        boxShadow:selected?`0 0 0 1px ${def.color}40,0 8px 32px rgba(0,0,0,0.7),0 0 24px ${def.color}20`:"0 4px 20px rgba(0,0,0,0.5)",
        transition:"border-color 0.15s,box-shadow 0.15s",
      }}
    >
      <div style={{height:3,background:def.color,borderRadius:"14px 14px 0 0"}}/>
      <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,height:MH-3}}>
        <div style={{width:34,height:34,borderRadius:9,background:def.bg,border:`1px solid ${def.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{def.emoji}</div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:12,fontWeight:700,color:"#fff",margin:0,lineHeight:1.2}}>{def.label}</p>
          <p style={{fontSize:10,color:"rgba(255,255,255,0.32)",margin:"3px 0 0",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{def.desc}</p>
        </div>
      </div>
      {def.hasIn&&(
        <div onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onPortIn(e,mod.id);}} style={{
          position:"absolute",left:-PORT_R,top:"50%",marginTop:-(PORT_R+1),width:PORT_R*2,height:PORT_R*2,borderRadius:"50%",
          background:canReceive?def.color:"#1e1e1e",border:`2px solid ${canReceive?def.color:"rgba(255,255,255,0.2)"}`,
          cursor:"pointer",zIndex:20,boxShadow:canReceive?`0 0 10px ${def.color}80`:"none",transition:"all 0.15s",
        }}/>
      )}
      {def.hasOut&&(
        <div onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onPortOut(e,mod.id);}} style={{
          position:"absolute",right:-PORT_R,top:"50%",marginTop:-(PORT_R+1),width:PORT_R*2,height:PORT_R*2,borderRadius:"50%",
          background:connecting===mod.id?def.color:"#1e1e1e",border:`2px solid ${connecting===mod.id?def.color:"rgba(255,255,255,0.2)"}`,
          cursor:"crosshair",zIndex:20,boxShadow:connecting===mod.id?`0 0 12px ${def.color}`:"none",transition:"all 0.15s",
        }}/>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BotLayoutPage(){
  // Workflow management
  const [allWF,      setAllWF]      = useState<WFRecord[]>([]);
  const [currentId,  setCurrentId]  = useState<string|null>(null);
  const [workflow,   setWorkflow]   = useState<Workflow>(defaultWF());
  const [wfEnabled,  setWfEnabled]  = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  // Canvas state
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [connecting, setConnecting] = useState<string|null>(null);
  const [view,       setView]       = useState<View>({panX:40,panY:40,zoom:0.8});
  const [saved,      setSaved]      = useState(false);
  const [ghostMouse, setGhostMouse] = useState({x:0,y:0});

  const wrapRef   = useRef<HTMLDivElement>(null);
  const dragRef   = useRef<{id:string;startCx:number;startCy:number;startMx:number;startMy:number}|null>(null);
  const panRef    = useRef<{startMx:number;startMy:number;startPx:number;startPy:number}|null>(null);
  const isPanning = useRef(false);

  const {modules,connections} = workflow;
  const selectedMod = modules.find(m=>m.id===selectedId)||null;

  // Screen → canvas coords
  const s2c = useCallback((sx:number,sy:number)=>{
    const r = wrapRef.current!.getBoundingClientRect();
    return {x:(sx-r.left-view.panX)/view.zoom, y:(sy-r.top-view.panY)/view.zoom};
  },[view]);

  // ── Load all workflows ───────────────────────────────────────────────────────
  const loadAll = useCallback(async(selectId?:string)=>{
    const {data} = await supabase.from("bot_workflows").select("*").order("created_at");
    if(!data) return;
    setAllWF(data as WFRecord[]);
    const target = selectId
      ? data.find(w=>w.id===selectId)
      : data.sort((a,b)=>new Date(b.updated_at||b.created_at||0).getTime()-new Date(a.updated_at||a.created_at||0).getTime())[0];
    if(target && !selectId){
      // only auto-select on first load
      setCurrentId(prev => prev ? prev : target.id);
      setWorkflow(prev => currentId ? prev : target.workflow as Workflow);
      setWfEnabled(prev => currentId ? prev : target.enabled);
    }
    if(selectId && target){
      setCurrentId(target.id);
      setWorkflow(target.workflow as Workflow);
      setWfEnabled(target.enabled);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{ loadAll(); },[loadAll]);

  // ── Wheel zoom (non-passive) ─────────────────────────────────────────────────
  useEffect(()=>{
    const el=wrapRef.current; if(!el) return;
    const onWheel=(e:WheelEvent)=>{
      e.preventDefault();
      const r=el.getBoundingClientRect();
      const mx=e.clientX-r.left, my=e.clientY-r.top;
      const f=e.deltaY<0?1.12:0.9;
      setView(v=>{
        const nz=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,v.zoom*f));
        const ratio=nz/v.zoom;
        return{zoom:nz,panX:mx-ratio*(mx-v.panX),panY:my-ratio*(my-v.panY)};
      });
    };
    el.addEventListener("wheel",onWheel,{passive:false});
    return()=>el.removeEventListener("wheel",onWheel);
  },[]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = useCallback(async()=>{
    const id = currentId || wfid();
    await supabase.from("bot_workflows").upsert({
      id, name:workflow.name, workflow, enabled:wfEnabled,
      updated_at:new Date().toISOString(),
    },{onConflict:"id"});
    if(!currentId) setCurrentId(id);
    setSaved(true); setTimeout(()=>setSaved(false),2000);
    // refresh list (don't auto-switch)
    const {data} = await supabase.from("bot_workflows").select("*").order("created_at");
    if(data) setAllWF(data as WFRecord[]);
  },[workflow,wfEnabled,currentId]);

  // ── New workflow ─────────────────────────────────────────────────────────────
  async function createNew(){
    const id=wfid();
    const wf=defaultWF(`Workflow ${allWF.length+1}`);
    await supabase.from("bot_workflows").insert({id,name:wf.name,workflow:wf,enabled:false});
    setCurrentId(id); setWorkflow(wf); setWfEnabled(false);
    setSelectedId(null); setConnecting(null);
    setTimeout(fitView,50);
    await loadAll(id);
  }

  // ── Switch workflow ──────────────────────────────────────────────────────────
  function switchWorkflow(id:string){
    const wf=allWF.find(w=>w.id===id); if(!wf) return;
    setCurrentId(id);
    setWorkflow(wf.workflow as Workflow);
    setWfEnabled(wf.enabled);
    setSelectedId(null); setConnecting(null);
  }

  // ── Delete workflow ──────────────────────────────────────────────────────────
  async function deleteWorkflow(){
    if(!currentId) return;
    await supabase.from("bot_workflows").delete().eq("id",currentId);
    const remaining=allWF.filter(w=>w.id!==currentId);
    if(remaining.length>0){
      const n=remaining[0];
      setCurrentId(n.id); setWorkflow(n.workflow as Workflow); setWfEnabled(n.enabled);
    } else {
      setCurrentId(null); setWorkflow(defaultWF()); setWfEnabled(false);
    }
    setDelConfirm(false); setSelectedId(null);
    const {data} = await supabase.from("bot_workflows").select("*").order("created_at");
    if(data) setAllWF(data as WFRecord[]);
  }

  // ── Toggle enabled (saves immediately) ──────────────────────────────────────
  async function toggleEnabled(val:boolean){
    setWfEnabled(val);
    if(currentId){
      await supabase.from("bot_workflows").update({enabled:val,updated_at:new Date().toISOString()}).eq("id",currentId);
      const {data} = await supabase.from("bot_workflows").select("*").order("created_at");
      if(data) setAllWF(data as WFRecord[]);
    }
  }

  // ── Add module ────────────────────────────────────────────────────────────────
  function addModule(type:MType){
    const cx=(CANVAS_W/2)+(Math.random()-.5)*200;
    const cy=(CANVAS_H/2)+(Math.random()-.5)*100;
    const mod:WModule={id:uid(),type,x:cx,y:cy,settings:{...DEFS[type].defaults}};
    setWorkflow(w=>({...w,modules:[...w.modules,mod]}));
    setSelectedId(mod.id);
  }

  // ── Canvas mouse events ──────────────────────────────────────────────────────
  function wrapMouseDown(e:React.MouseEvent<HTMLDivElement>){
    isPanning.current=true;
    panRef.current={startMx:e.clientX,startMy:e.clientY,startPx:view.panX,startPy:view.panY};
    setSelectedId(null); setConnecting(null); e.preventDefault();
  }
  function wrapMouseMove(e:React.MouseEvent<HTMLDivElement>){
    const cp=s2c(e.clientX,e.clientY);
    setGhostMouse({...cp});
    if(dragRef.current){
      const dx=cp.x-dragRef.current.startCx, dy=cp.y-dragRef.current.startCy;
      setWorkflow(w=>({...w,modules:w.modules.map(m=>m.id===dragRef.current!.id?{...m,x:dragRef.current!.startMx+dx,y:dragRef.current!.startMy+dy}:m)}));
    } else if(isPanning.current&&panRef.current){
      setView(v=>({...v,panX:panRef.current!.startPx+(e.clientX-panRef.current!.startMx),panY:panRef.current!.startPy+(e.clientY-panRef.current!.startMy)}));
    }
  }
  function wrapMouseUp(){ dragRef.current=null; isPanning.current=false; panRef.current=null; }

  function startDrag(e:React.MouseEvent,mod:WModule){
    e.stopPropagation(); e.preventDefault();
    const cp=s2c(e.clientX,e.clientY);
    dragRef.current={id:mod.id,startCx:cp.x,startCy:cp.y,startMx:mod.x,startMy:mod.y};
    setSelectedId(mod.id);
  }
  function portOut(e:React.MouseEvent,id:string){ e.stopPropagation(); setConnecting(p=>p===id?null:id); }
  function portIn(e:React.MouseEvent,id:string){
    e.stopPropagation();
    if(!connecting||connecting===id) return;
    if(!connections.some(c=>c.fromId===connecting&&c.toId===id)){
      setWorkflow(w=>({...w,connections:[...w.connections,{id:cuid(),fromId:connecting,toId:id}]}));
    }
    setConnecting(null);
  }
  function delConn(id:string){ setWorkflow(w=>({...w,connections:w.connections.filter(c=>c.id!==id)})); }
  function delMod(id:string){
    setWorkflow(w=>({...w,modules:w.modules.filter(m=>m.id!==id),connections:w.connections.filter(c=>c.fromId!==id&&c.toId!==id)}));
    setSelectedId(null);
  }
  function updSettings(id:string,settings:Record<string,unknown>){
    setWorkflow(w=>({...w,modules:w.modules.map(m=>m.id===id?{...m,settings}:m)}));
  }

  // ── Zoom helpers ─────────────────────────────────────────────────────────────
  function zoomTo(f:number){
    setView(v=>{
      const nz=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,v.zoom*f));
      const r=nz/v.zoom;
      const cx=(wrapRef.current?.clientWidth||800)/2, cy=(wrapRef.current?.clientHeight||600)/2;
      return{zoom:nz,panX:cx-r*(cx-v.panX),panY:cy-r*(cy-v.panY)};
    });
  }
  function fitView(){
    if(!modules.length) return;
    const minX=Math.min(...modules.map(m=>m.x))-40, minY=Math.min(...modules.map(m=>m.y))-40;
    const maxX=Math.max(...modules.map(m=>m.x+MW))+40, maxY=Math.max(...modules.map(m=>m.y+MH))+40;
    const cw=wrapRef.current?.clientWidth||800, ch=wrapRef.current?.clientHeight||600;
    const z=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,Math.min(cw/(maxX-minX),ch/(maxY-minY))*0.9));
    setView({zoom:z,panX:(cw-(maxX-minX)*z)/2-minX*z,panY:(ch-(maxY-minY)*z)/2-minY*z});
  }

  const conMod = connecting ? modules.find(m=>m.id===connecting) : null;
  const ghostPath = conMod ? bezier(outPt(conMod).x,outPt(conMod).y,ghostMouse.x,ghostMouse.y) : null;
  const cursorStyle = isPanning.current ? "grabbing" : connecting ? "crosshair" : "default";

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#080808",color:"#fff",overflow:"hidden"}}>
      <style>{`
        @keyframes slideIn{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)}}
        select option{background:#141414}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{height:50,flexShrink:0,display:"flex",alignItems:"center",gap:8,padding:"0 14px",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(8,8,8,0.98)",backdropFilter:"blur(12px)"}}>
        <span style={{fontSize:17}}>🤖</span>
        <span style={{fontSize:13,fontWeight:800,letterSpacing:"-0.01em"}}>Bot Layout</span>
        <span style={{fontSize:9,color:"rgba(255,255,255,0.2)",fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase"}}>Workflow Builder</span>

        <div style={{width:1,height:18,background:"rgba(255,255,255,0.07)",margin:"0 4px"}}/>

        {/* Workflow selector */}
        <select value={currentId||""} onChange={e=>switchWorkflow(e.target.value)}
          style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"4px 8px",color:"#fff",fontSize:12,outline:"none",maxWidth:190,cursor:"pointer"}}>
          {allWF.length===0&&<option value="">— žiadne workflows —</option>}
          {allWF.map(wf=><option key={wf.id} value={wf.id}>{wf.name}{wf.enabled?" 🟢":""}</option>)}
        </select>

        {/* New */}
        <button onClick={createNew} title="Nový workflow"
          style={{width:28,height:28,borderRadius:7,background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.2)",color:"#22c55e",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,flexShrink:0}}>+</button>

        {/* Delete confirm */}
        {currentId&&!delConfirm&&(
          <button onClick={()=>setDelConfirm(true)} title="Vymazať"
            style={{width:28,height:28,borderRadius:7,background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.15)",color:"rgba(239,68,68,0.6)",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>🗑</button>
        )}
        {delConfirm&&(
          <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"3px 8px"}}>
            <span style={{fontSize:11,color:"#ef4444",fontWeight:600}}>Naozaj?</span>
            <button onClick={deleteWorkflow} style={{padding:"2px 8px",borderRadius:5,background:"#ef4444",border:"none",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>Áno</button>
            <button onClick={()=>setDelConfirm(false)} style={{padding:"2px 8px",borderRadius:5,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",fontSize:11,cursor:"pointer"}}>Nie</button>
          </div>
        )}

        <div style={{width:1,height:18,background:"rgba(255,255,255,0.07)",margin:"0 2px"}}/>

        {/* Name input */}
        <input value={workflow.name} onChange={e=>setWorkflow(w=>({...w,name:e.target.value}))}
          style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,padding:"4px 10px",color:"#fff",fontSize:12,fontWeight:600,outline:"none",width:170}}/>

        <div style={{flex:1}}/>

        {/* Enabled toggle */}
        <div style={{display:"flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.03)",border:`1px solid ${wfEnabled?"rgba(34,197,94,0.25)":"rgba(255,255,255,0.07)"}`,borderRadius:9,padding:"4px 10px",flexShrink:0}}>
          <button onClick={()=>toggleEnabled(!wfEnabled)}
            style={{width:34,height:18,borderRadius:9,cursor:"pointer",background:wfEnabled?"#22c55e":"rgba(255,255,255,0.08)",border:"none",position:"relative",transition:"background 0.2s",flexShrink:0}}>
            <div style={{position:"absolute",top:1,left:wfEnabled?16:1,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
          </button>
          <span style={{fontSize:11,fontWeight:700,color:wfEnabled?"#22c55e":"rgba(255,255,255,0.3)",letterSpacing:"0.03em",whiteSpace:"nowrap"}}>
            {wfEnabled?"AKTÍVNY":"NEAKTÍVNY"}
          </span>
        </div>

        <div style={{width:1,height:18,background:"rgba(255,255,255,0.07)",margin:"0 4px"}}/>

        {/* Zoom controls */}
        <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"3px 6px",border:"1px solid rgba(255,255,255,0.07)",flexShrink:0}}>
          <button onClick={()=>zoomTo(0.85)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:16,padding:"0 4px",lineHeight:1}}>−</button>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",minWidth:34,textAlign:"center"}}>{Math.round(view.zoom*100)}%</span>
          <button onClick={()=>zoomTo(1.18)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:14,padding:"0 4px",lineHeight:1}}>+</button>
        </div>
        <button onClick={fitView} style={{padding:"5px 10px",borderRadius:7,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.55)",fontSize:11,cursor:"pointer",fontWeight:600,flexShrink:0}}>↔ Fit</button>

        {connecting&&(
          <button onClick={()=>setConnecting(null)} style={{padding:"5px 12px",borderRadius:7,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",color:"#ef4444",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>✕ Zrušiť</button>
        )}
        <button onClick={save} style={{padding:"6px 14px",borderRadius:8,background:saved?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.06)",border:`1px solid ${saved?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.1)"}`,color:saved?"#22c55e":"rgba(255,255,255,0.65)",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.2s",flexShrink:0}}>
          {saved?"✓ Uložené":"💾 Uložiť"}
        </button>
      </div>

      {/* ── BODY ── */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>

        {/* ── LEFT PANEL: palette + workflow list ── */}
        <div style={{width:190,flexShrink:0,background:"#0d0d0d",borderRight:"1px solid rgba(255,255,255,0.06)",overflowY:"auto",padding:"10px 8px",display:"flex",flexDirection:"column",gap:0}}>
          <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.18em",color:"rgba(255,255,255,0.18)",textTransform:"uppercase",padding:"2px 4px",marginBottom:8}}>Moduly</p>
          {PALETTE.map(type=>{
            const d=DEFS[type];
            return (
              <button key={type} onClick={()=>addModule(type)}
                style={{width:"100%",textAlign:"left",padding:"7px 9px",borderRadius:9,cursor:"pointer",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",marginBottom:5,display:"flex",alignItems:"center",gap:8,transition:"all 0.15s"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=d.bg;(e.currentTarget as HTMLElement).style.borderColor=d.border;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.02)";(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.05)";}}
              >
                <span style={{fontSize:15,flexShrink:0}}>{d.emoji}</span>
                <p style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.75)",margin:0,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{d.label}</p>
              </button>
            );
          })}

          {allWF.length>0&&<>
            <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"10px 0"}}/>
            <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.18em",color:"rgba(255,255,255,0.18)",textTransform:"uppercase",padding:"2px 4px",marginBottom:8}}>Workflows</p>
            {allWF.map(wf=>(
              <button key={wf.id} onClick={()=>switchWorkflow(wf.id)}
                style={{width:"100%",textAlign:"left",padding:"6px 9px",borderRadius:8,cursor:"pointer",
                  background:wf.id===currentId?"rgba(139,92,246,0.1)":"rgba(255,255,255,0.02)",
                  border:`1px solid ${wf.id===currentId?"rgba(139,92,246,0.3)":"rgba(255,255,255,0.05)"}`,
                  marginBottom:4,display:"flex",alignItems:"center",gap:6,transition:"all 0.15s"}}
              >
                <div style={{width:6,height:6,borderRadius:"50%",background:wf.enabled?"#22c55e":"rgba(255,255,255,0.15)",flexShrink:0}}/>
                <p style={{fontSize:11,fontWeight:wf.id===currentId?700:500,color:wf.id===currentId?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.4)",margin:0,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{wf.name}</p>
              </button>
            ))}
          </>}
        </div>

        {/* ── CANVAS ── */}
        <div ref={wrapRef} onMouseDown={wrapMouseDown} onMouseMove={wrapMouseMove} onMouseUp={wrapMouseUp} onMouseLeave={wrapMouseUp}
          style={{flex:1,overflow:"hidden",position:"relative",cursor:cursorStyle}}>

          {/* Empty state */}
          {!currentId&&allWF.length===0&&(
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,pointerEvents:"none",zIndex:30}}>
              <span style={{fontSize:48,opacity:0.3}}>🤖</span>
              <p style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.2)"}}>Žiadne workflows</p>
              <p style={{fontSize:12,color:"rgba(255,255,255,0.12)"}}>Klikni na + pre vytvorenie nového</p>
            </div>
          )}

          {/* Canvas inner */}
          <div style={{position:"absolute",top:0,left:0,width:CANVAS_W,height:CANVAS_H,
            transform:`translate(${view.panX}px,${view.panY}px) scale(${view.zoom})`,
            transformOrigin:"0 0",
            backgroundImage:"radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize:"28px 28px",
          }}>
            {/* SVG connections */}
            <svg style={{position:"absolute",inset:0,width:CANVAS_W,height:CANVAS_H,overflow:"visible",pointerEvents:"none",zIndex:2}}>
              <defs>
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
                const op=outPt(fm), ip=inPt(tm);
                return (
                  <g key={conn.id} style={{pointerEvents:"all"}}>
                    <path d={bezier(op.x,op.y,ip.x,ip.y)} stroke="transparent" strokeWidth="12" fill="none" onClick={e=>{e.stopPropagation();delConn(conn.id);}} style={{cursor:"pointer"}}/>
                    <path d={bezier(op.x,op.y,ip.x,ip.y)} stroke={DEFS[fm.type].color} strokeWidth="2" fill="none" strokeOpacity="0.7" markerEnd={`url(#a-${fm.type})`}/>
                  </g>
                );
              })}
              {ghostPath&&<path d={ghostPath} stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="7 4" fill="none" markerEnd="url(#a-ghost)"/>}
            </svg>

            {/* Modules */}
            {modules.map(mod=>(
              <ModuleNode key={mod.id} mod={mod} selected={selectedId===mod.id} connecting={connecting}
                onMouseDown={e=>startDrag(e,mod)} onPortOut={portOut} onPortIn={portIn}/>
            ))}

            {modules.length===0&&currentId&&(
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}}>
                <span style={{fontSize:44}}>📭</span>
                <p style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.2)"}}>Plátno je prázdne</p>
                <p style={{fontSize:12,color:"rgba(255,255,255,0.12)"}}>Pridaj moduly z ľavého panela</p>
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
            <div style={{width:230,flexShrink:0,background:"#0d0d0d",borderLeft:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,gap:10,textAlign:"center"}}>
              <span style={{fontSize:32,opacity:0.4}}>👆</span>
              <p style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.2)",lineHeight:1.5,margin:0}}>Klikni na modul pre nastavenia</p>
              {currentId&&(
                <div style={{marginTop:8,padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",width:"100%"}}>
                  <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"rgba(255,255,255,0.2)",textTransform:"uppercase",marginBottom:6}}>Tento workflow</p>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:wfEnabled?"#22c55e":"rgba(255,255,255,0.15)"}}/>
                    <span style={{fontSize:11,color:wfEnabled?"#22c55e":"rgba(255,255,255,0.3)",fontWeight:600}}>{wfEnabled?"Aktívny bot":"Neaktívny"}</span>
                  </div>
                  <p style={{fontSize:10,color:"rgba(255,255,255,0.15)",margin:0}}>{modules.length} modulov · {connections.length} spojení</p>
                </div>
              )}
              <div style={{height:1,width:"80%",background:"rgba(255,255,255,0.05)",margin:"2px 0"}}/>
              <p style={{fontSize:10,color:"rgba(255,255,255,0.15)",lineHeight:1.5,margin:0}}>Klik výstupný port → vstupný port pre spojenie. Klik čiaru pre zmazanie.</p>
            </div>
          )
        }
      </div>
    </div>
  );
}
