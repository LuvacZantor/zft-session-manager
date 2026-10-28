import {postChronicle} from "./chronicle.js";

const ID = "zft-session-manager";
const VERSION = "0.1.0-dev.5";
const KEY = "registry";
let inFlight = false;
let startupPrompted = false;

const copy = value => foundry.utils.deepClone(value);
const state = () => copy(game.settings.get(ID, KEY));
const current = data => (data?.sessions ?? []).find(s => s.id === data.activeId) ?? null;
const activeSession = () => current(state());
const assertGM = () => { if (!game.user?.isGM) throw new Error("Only a GM can manage sessions."); };
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const defaultName = () => new Intl.DateTimeFormat("en-US",{year:"numeric",month:"long",day:"numeric"}).format(new Date());
const emit = (event,record) => Hooks.callAll(`zftSessionManager.${event}`,copy(record));

async function operate(action) {
  assertGM();
  if (inFlight) throw new Error("A session operation is already underway on this client.");
  inFlight = true;
  try { return await action(); }
  finally { inFlight = false; }
}

async function startSession(name) {
  return operate(async () => {
    const data=state();
    if (current(data)) throw new Error("End the active session before starting another.");
    const label=String(name ?? "").trim() || defaultName();
    const record={id:foundry.utils.randomID(),name:label,startedAt:Date.now(),endedAt:null,createdBy:game.user.id,chronicle:{start:{status:"not-attempted",messageId:null},end:{status:"not-attempted",messageId:null}}};
    data.sessions.push(record);
    data.activeId=record.id;
    await game.settings.set(ID,KEY,data);
    emit("started",record);
    // Save the intent BEFORE posting. Refresh/resume never post a second announcement.
    const reserved=state();
    const item=reserved.sessions.find(s=>s.id===record.id);
    if (item) {
      item.chronicle.start.status="attempted";
      await game.settings.set(ID,KEY,reserved);
    }
    try {
      const result=await postChronicle(record.id,"start");
      const updated=state();
      const stored=updated.sessions.find(s=>s.id===record.id);
      if (stored) { stored.chronicle.start={status:"posted",...result}; await game.settings.set(ID,KEY,updated); }
    } catch(error) {
      console.warn(`[ZFT] v${VERSION} | Chronicle unavailable or failed`,error);
      ui.notifications.warn(`Session started. Chronicle was not posted: ${error.message}`);
    }
    ui.notifications.info(`Session started: ${label}`);
    return copy(record);
  });
}

async function endSession() {
  return operate(async () => {
    const data=state(), record=current(data);
    if (!record) throw new Error("No active session to end.");
    record.endedAt=Date.now();
    data.activeId=null;
    await game.settings.set(ID,KEY,data);
    emit("ended",record);
    // End-announcement intent is recorded BEFORE posting, preventing automatic duplicate posts.
    const reserved=state();
    const item=reserved.sessions.find(s=>s.id===record.id);
    if(item){
      if(!item.chronicle || !item.chronicle.end) item.chronicle={...(item.chronicle??{}),end:{status:"not-attempted",messageId:null}};
      item.chronicle.end.status="attempted";
      await game.settings.set(ID,KEY,reserved);
    }
    try {
      const result=await postChronicle(record.id,"end");
      const updated=state(), stored=updated.sessions.find(s=>s.id===record.id);
      if(stored){ stored.chronicle.end={status:"posted",...result};await game.settings.set(ID,KEY,updated); }
    } catch(error) {
      console.warn(`[ZFT] v${VERSION} | End Chronicle unavailable or failed`,error);
      ui.notifications.warn(`Session ended. Chronicle was not posted: ${error.message}`);
    }
    ui.notifications.info(`Session ended: ${record.name}`);
    return copy(record);
  });
}

async function resumeSession(id) {
  return operate(async () => {
    const data=state();
    if (current(data)) throw new Error("End the active session before resuming another.");
    const record=data.sessions.find(s=>s.id===id);
    if (!record) throw new Error("Selected session does not exist.");
    record.endedAt=null;
    record.resumedAt=Date.now();
    data.activeId=record.id;
    await game.settings.set(ID,KEY,data);
    emit("resumed",record);
    ui.notifications.info(`Session resumed: ${record.name}`);
    return copy(record);
  });
}

function fmtTime(timestamp) { return timestamp ? new Date(timestamp).toLocaleString() : "—"; }

class SessionDashboard extends Application {
  minimized=false;
  getHeaderButtons(){
    const buttons=super.getHeaderButtons();
    buttons.unshift({label:"Minimize",class:"zft-sm-minimize",icon:"fas fa-window-minimize",onclick:()=>this.toggleMinimize()});
    return buttons;
  }
  toggleMinimize(){
    this.minimized=!this.minimized;
    if(this.element?.length){
      this.element.toggleClass("zft-sm-minimized",this.minimized);
      this.element.find(".zft-sm-dashboard").toggle(!this.minimized);
      this.element.find(".zft-sm-minimize i").toggleClass("fa-window-minimize",!this.minimized).toggleClass("fa-window-restore",this.minimized);
      this.element.find(".zft-sm-minimize").attr("title",this.minimized?"Restore":"Minimize");
      if(this.minimized){this._zftPreviousHeight=this.element.height();this.setPosition({height:50});}
      else this.setPosition({height:this._zftPreviousHeight??"auto"});
    }
  }
  close(options){this.minimized=false;return super.close(options);}

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:"zft-session-dashboard",title:"ZFT Session Manager",width:470,height:"auto",
      classes:["zft-session-manager-window"],resizable:true,popOut:true
    });
  }
  async _renderInner() {
    const data=state(), ongoing=current(data);
    const completed=data.sessions.filter(s=>s.endedAt!==null).slice().reverse();
    const opts=completed.map(s=>`<option value="${escape(s.id)}">${escape(s.name)} · ${escape(fmtTime(s.startedAt))}</option>`).join("");
    const history=data.sessions.slice().reverse().map(s=>`<li><div class="zft-sm-history-info"><strong>${escape(s.name)}</strong><small>${escape(fmtTime(s.startedAt))}${s.endedAt ? ` → ${escape(fmtTime(s.endedAt))}` : " · In progress"}</small></div><span class="zft-sm-pill ${s.endedAt ? "ended":"active"}">${s.endedAt ? "Ended":"Active"}</span></li>`).join("");
    const html=`<section class="zft-sm-dashboard">
      <header class="zft-sm-hero"><span class="zft-sm-kicker">ZANTOR'S REALMS · SESSION CONTROL</span><div class="zft-sm-title"><i class="fas fa-calendar-check"></i><h2>SESSION MANAGER</h2></div><p>One session record for your entire game night.</p></header>
      <div class="zft-sm-panel"><div class="zft-sm-panel-top"><span class="zft-sm-eyebrow">CURRENT STATUS</span><span class="zft-sm-pill ${ongoing ? "active":"ended"}">${ongoing ? "● ACTIVE":"○ INACTIVE"}</span></div>
      ${ongoing ? `<h3>${escape(ongoing.name)}</h3><p class="zft-sm-meta"><i class="fas fa-clock"></i> Started ${escape(fmtTime(ongoing.startedAt))}</p><p class="zft-sm-description">End your session to record its conclusion and post the closing Calendaria Chronicle.</p><button type="button" class="zft-sm-action danger" data-action="end"><i class="fas fa-stop-circle"></i> END SESSION</button>` : `<h3>Ready when you are</h3><p class="zft-sm-description">Nothing begins automatically. Confirm a new session when you are ready to play.</p><label class="zft-sm-label" for="zft-sm-name">SESSION NAME</label><input id="zft-sm-name" type="text" maxlength="120" value="${escape(defaultName())}"/><button type="button" class="zft-sm-action primary" data-action="start"><i class="fas fa-play"></i> START SESSION</button>${opts ? `<div class="zft-sm-separator">OR RESUME PREVIOUS</div><select id="zft-sm-resume">${opts}</select><button type="button" class="zft-sm-action secondary" data-action="resume"><i class="fas fa-rotate-left"></i> RESUME SELECTED</button>` : ""}`}
      </div>
      <details class="zft-sm-history"><summary><span><i class="fas fa-scroll"></i> SESSION HISTORY <small>${data.sessions.length} recorded</small></span><i class="fas fa-chevron-down"></i></summary><ul>${history || '<li class="zft-sm-empty">No sessions recorded yet.</li>'}</ul></details>
      <footer class="zft-sm-footer"><span><i class="fas fa-moon"></i> CHRONICLE</span> In-game date/time is announced at both start and end if Calendaria is available.</footer>
    </section>`;
    return $(html);
  }
  activateListeners(html) {
    super.activateListeners(html);
    this.element.toggleClass("zft-sm-minimized",this.minimized);
    if(this.minimized) html.hide();
    html.find("[data-action]").on("click",async event=>{
      const button=$(event.currentTarget),action=button.data("action");
      if(inFlight)return;
      button.prop("disabled",true);
      try {
        if(action==="start") await startSession(html.find("#zft-sm-name").val());
        else if(action==="end") await endSession();
        else if(action==="resume") await resumeSession(html.find("#zft-sm-resume").val());
        await this.render(true);
      } catch(error) {console.error(`[ZFT] Session action failed`,error);ui.notifications.error(`Session Manager: ${error.message}`);button.prop("disabled",false);}
    });
  }
}
let dashboard;
async function openManager(){
  assertGM();
  if(!dashboard) dashboard=new SessionDashboard();
  if(dashboard.minimized && dashboard.rendered) dashboard.toggleMinimize();
  return dashboard.render(true);
}
async function toggleManager(){
  assertGM();
  if(dashboard?.rendered){await dashboard.close();return;}
  return openManager();
}
// Prefer the existing ZFT Tools launcher. Registering via the collection hook
// avoids module initialization order assumptions and keeps the integration optional.
const zftTool = () => ({
  name: "zft-session-manager", title: "Session Manager",
  icon: "fa-solid fa-calendar-check", order: 50, button: true,
  visible: game.user?.isGM === true, gmOnly: true,
  onChange: () => { void toggleManager().catch(e => ui.notifications.error(`Session Manager: ${e.message}`)); }
});
const toolsAvailable = () => game.modules.get("zft-tools")?.active === true;
Hooks.on("zft-tools.collectTools", tools => {
  if (!game.user?.isGM || !toolsAvailable()) return;
  tools["zft-session-manager"] = zftTool();
});
// Standalone fallback when ZFT Tools isn't enabled. Do not create a second
// launcher when ZFT Tools is handling this action.
Hooks.on("getSceneControlButtons", controls => {
  if (!game.user?.isGM || toolsAvailable()) return;
  const tool = {name:"zft-session-manager",title:"Session Manager",icon:"fa-solid fa-calendar-check",button:true,visible:true,onChange:()=>void toggleManager().catch(e=>ui.notifications.error(`Session Manager: ${e.message}`))};
  if (Array.isArray(controls)) {
    const group=controls.find(c=>c.name==="tokens");
    if (!group) return;
    if (Array.isArray(group.tools) && !group.tools.some(t=>t.name===tool.name)) group.tools.push(tool);
    else if (group.tools && !Array.isArray(group.tools)) group.tools[tool.name]=tool;
    return;
  }
  const group=controls?.tokens;
  if (!group) return;
  if(Array.isArray(group.tools)) {
    if(!group.tools.some(t=>t.name===tool.name))group.tools.push(tool);
  } else {
    group.tools??={}; group.tools[tool.name]=tool;
  }
});

Hooks.once("init",()=>{
  game.settings.register(ID,KEY,{name:"Session records",scope:"world",config:false,type:Object,default:{activeId:null,sessions:[]}});
  game.settings.register(ID,"promptOnGMReady",{name:"Prompt GM when no session is active",hint:"Offers session management on GM connection. Does not automatically start a session.",scope:"world",config:true,type:Boolean,default:true});
  const api=Object.freeze({getActiveSession:activeSession,listSessions:()=>copy(state().sessions),getSession:id=>copy(state().sessions.find(s=>s.id===id)??null),startSession,endSession,resumeSession,openManager,toggleManager});
  globalThis.ZFTSessionManager=Object.freeze({version:VERSION,api});
  game.settings.registerMenu(ID,"manage",{name:"Session Management",label:"Open Session Manager",hint:"Start, end, resume, and review sessions.",icon:"fas fa-calendar-check",type:class SessionManagerMenu extends FormApplication {
    static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{id:"zft-session-manager-menu",title:"ZFT Session Manager",template:"templates/blank.html",width:1,height:1});}
    render(force,options){void openManager();return this;}
  },restricted:true});
});

Hooks.once("ready",()=>{
  console.log(`[ZFT] ✅ v${VERSION} | Session Manager ready`);
  if(!game.user.isGM || !game.settings.get(ID,"promptOnGMReady") || activeSession() || startupPrompted) return;
  const leader=game.users.filter(user=>user.isGM&&user.active).sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0];
  if (leader?.id!==game.user.id) return;
  startupPrompted=true;
  void openManager();
});
