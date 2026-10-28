// Calendaria Chronicle v1.6.0 embedded in ZFT Session Manager.
export async function postChronicle(sessionId,phase="start") {
  const api = globalThis.CALENDARIA?.api;
  if (typeof api?.getCurrentDateTime !== "function" || typeof api?.formatDate !== "function") {
    throw new Error("Calendaria API is not available. Check that Calendaria is enabled.");
  }
  const now = api.getCurrentDateTime();
  const hour = Number(now?.hour);
  if (!now || !Number.isFinite(hour)) throw new Error("Calendaria returned an invalid date/time.");
  const date = api.formatDate(now, "D MMMM, YYYY");
  const pad = value => String(Math.trunc(Number(value ?? 0))).padStart(2, "0");
  const time = `${pad(now.hour)}:${pad(now.minute)}:${pad(now.second)}`;
  let timeOfDay;
  if (hour < 5) timeOfDay = "DEAD OF NIGHT";
  else if (hour < 7) timeOfDay = "DAWN";
  else if (hour < 12) timeOfDay = "MORNING";
  else if (hour < 17) timeOfDay = "AFTERNOON";
  else if (hour < 20) timeOfDay = "EVENING";
  else timeOfDay = "NIGHT";
  const escape = value => foundry.utils.escapeHTML(String(value));
  const heading = phase === "end" ? "SESSION ENDS" : "SESSION BEGINS";
  const content = `
    <div class="zft-session-chronicle" data-session-id="${escape(sessionId)}" data-phase="${escape(phase)}" style="background:linear-gradient(145deg,#130e1e,#251632);border:1px solid #62496d;border-radius:10px;padding:16px 12px;text-align:center;color:#e9dfed;box-shadow:inset 0 0 14px #0007;">
      <div style="color:#a9df93;font-size:12px;letter-spacing:5px;margin-bottom:8px;">◆ ◇ ◆</div>
      <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:3px;font-weight:bold;">CHRONICLE</div>
      <div style="color:#a9df93;font-size:11px;letter-spacing:3px;margin-top:6px;">${escape(heading)}</div>
      <div style="border-top:1px solid #55405f;margin:10px auto;width:80%;"></div>
      <div style="color:#b5a9bf;font-size:10px;letter-spacing:2px;margin-bottom:5px;">THE DATE IS</div>
      <div style="font-family:Georgia,serif;font-size:20px;color:#f1e9d8;margin-bottom:12px;">${escape(date)}</div>
      <div style="font-size:12px;font-weight:bold;letter-spacing:3px;color:#a9df93;margin-bottom:5px;">${escape(timeOfDay)}</div>
      <div style="font-family:Georgia,serif;font-size:27px;color:#f1e9d8;letter-spacing:2px;font-variant-numeric:tabular-nums;">${escape(time)}</div>
      <div style="color:#a9df93;font-size:12px;letter-spacing:5px;margin-top:10px;">◆ ◇ ◆</div>
    </div>`;
  const message = await ChatMessage.create({speaker:ChatMessage.getSpeaker(), content});
  return {messageId:message.id, date,time,timeOfDay};
}
