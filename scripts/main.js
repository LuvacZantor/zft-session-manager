import { postChronicle } from "./chronicle.js";
const ID = "zft-session-manager";
const VERSION = "0.1.0-dev.1";
const SETTING = "registry";
let prompted = false;
let busy = false;

const registry = () => foundry.utils.deepClone(game.settings.get(ID, SETTING));
const active = data => (data ?? registry()).sessions.find(s => s.id === (data ?? registry()).activeId) ?? null;
const assertGM = () => { if (!game.user?.isGM) throw new Error("Only a GM may manage sessions."); };
const save = data => game.settings.set(ID, SETTING, data);
const emit = (event, session) => Hooks.callAll(`zftSessionManager.${event}`, foundry.utils.deepClone(session));
function dateLabel() { return new Intl.DateTimeFormat("en-US",{year:"numeric",month:"short",day:"numeric"}).format(new Date()); }

async function startSession(name) {
  assertGM();
  if (busy) return null;
  busy = true;
  try {
    const data = registry();
    if (active(data)) throw new Error("End the active session before starting another.");
    const session = {id:foundry.utils.randomID(),name:String(name || dateLabel()).trim() || dateLabel(),startedAt:Date.now(),endedAt:null,createdBy:game.user.id,chronicle:{status:"pending",messageId:null}};
    data.sessions.push(session); data.activeId = session.id;
    await save(data); emit("started",session);
    // Persist session before announcing. A reconnect never re-posts an announcement.
    // Ambiguous failed posts remain pending and require explicit GM recovery, not automatic duplication.
    try {
      const outcome = await postChronicle();
      const current = registry();
      const stored = current.sessions.find(s => s.id === session.id);
      if (stored) { stored.chronicle={status:"posted",...outcome}; await save(current); }
    } catch(error) {
      console.warn(`[ZFT] v${VERSION} | Chronicle was not posted`,error);
      ui.notifications.warn(`Session started, but Chronicle was not posted: ${error.message}`);
    }
    ui.notifications.info(`Session started: ${session.name}`);
    return session;
  } finally { busy=false; }
}
async function endSession() {
  assertGM();
  if (busy) return null;
  busy=true;
  try {
    const data=registry(), session=active(data);
    if (!session) return null;
    session.endedAt=Date.now(); data.activeId=null; await save(data);
    emit("ended",session); ui.notifications.info(`Session ended: ${session.name}`);
    return session;
  } finally { busy=false; }
}
async function resumeSession(sessionId) {
  assertGM();
  if (busy) return null;
  busy=true;
  try {
    const data=registry();
    if (active(data)) throw new Error("End the current session before resuming another.");
    const session=data.sessions.find(s=>s.id===sessionId);
    if (!session) throw new Error("Session was not found.");
    session.endedAt=null; session.resumedAt=Date.now(); data.activeId=session.id;
    await save(data); emit("resumed",session);
    ui.notifications.info(`Session resumed: ${session.name}`);
    return session;
  } finally { busy=false; }
}
async function confirmStart() {
  const name = await Dialog.prompt({title:"Start Game Session",content:`<form><div class="form-group"><label>Session name</label><input type="text" name="sessionName" value="${dateLabel()}" /></div></form>`,callback:html=>html.find('[name="sessionName"]').val(),rejectClose:false});
  if (name == null) return;
  try { await startSession(name); } catch(e){ ui.notifications.error(e.message); }
}
async function manage() {
  assertGM();
  const data=registry(), current=active(data);
  if(current) {
    const choice=await new Promise(resolve=>new Dialog({title:"ZFT Session Manager",content:`<p>Active session: <strong>${foundry.utils.escapeHTML(current.name)}</strong></p>`,buttons:{end:{label:"End Session",callback:()=>resolve("end")},dismiss:{label:"Keep Session Open",callback:()=>resolve(null)}},default:"dismiss",close:()=>resolve(null)}).render(true));
    if(choice==="end") await endSession();
    return;
  }
  const completed=data.sessions.filter(s=>s.endedAt!=null).slice().reverse();
  const options=completed.map(s=>`<option value="${s.id}">${foundry.utils.escapeHTML(s.name)}</option>`).join("");
  const content=`<p>No active session.</p>${options ? `<div class="form-group"><label>Previously ended sessions</label><select id="zft-resume-session">${options}</select></div>` : ""}`;
  const choice=await new Promise(resolve=>new Dialog({title:"ZFT Session Manager",content,buttons:{start:{label:"Start New",callback:()=>resolve({action:"start"})},...(completed.length?{resume:{label:"Resume Selected",callback:html=>resolve({action:"resume",id:html.find("#zft-resume-session").val()})}}:{}),later:{label:"Not Now",callback:()=>resolve(null)}},default:"later",close:()=>resolve(null)}).render(true));
  if(!choice) return;
  if(choice.action==="start") return confirmStart();
  try { await resumeSession(choice.id); } catch(e){ui.notifications.error(e.message);}
}
Hooks.once("init",()=>{
  game.settings.register(ID,SETTING,{name:"Session registry",scope:"world",config:false,type:Object,default:{activeId:null,sessions:[]}});
  game.settings.register(ID,"promptOnGMReady",{name:"Prompt GM when no session is active",hint:"Offers a session start/resume choice on GM login. Never starts sessions automatically.",scope:"world",config:true,type:Boolean,default:true});
  const api=Object.freeze({getActiveSession:()=>active(),listSessions:()=>foundry.utils.deepClone(registry().sessions),getSession:id=>foundry.utils.deepClone(registry().sessions.find(s=>s.id===id)??null),startSession,endSession,resumeSession,openManager:manage});
  globalThis.ZFTSessionManager=Object.freeze({version:VERSION,api});
});
Hooks.once("ready",()=>{
  console.log(`[ZFT] ✅ v${VERSION} | ZFT Session Manager ready`);
  if(!game.user.isGM) return;
  // Single chosen active GM to avoid prompts from multiple GM browsers.
  const leader=game.users.filter(u=>u.isGM&&u.active).sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0];
  if(leader?.id!==game.user.id) return;
  if(game.settings.get(ID,"promptOnGMReady")&&!active()&&!prompted){
    prompted=true; void manage();
  }
});
