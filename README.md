# ZFT Session Manager

Foundry VTT V13 development module (`0.1.0-dev.1`).

## Purpose
One shared GM-confirmed session identity for ZFT modules, independent of combat lifecycle.

## Behavior
- An active GM is offered Start/Resume/Not Now after connecting when no session is active; no automatic session start.
- Session records persist in world setting `zft-session-manager.registry` with stable ID, name, real-world start/end timestamps, and active ID.
- `game.user.isGM` is required to start, resume, end, or open management.
- Start posts the Calendaria Chronicle v1.6.0 design to **normal** Foundry Chat, if Calendaria is enabled.
- Resuming never posts the Chronicle again. Refreshing or reconnecting never auto-posts.
- Chronicle failures do **not** cancel session creation. The status remains pending for manual review; there is no automatic retry to avoid duplicate posts.
- Optional Calendaria dependency; game session management works without it.
- The manager is accessible programmatically as `ZFTSessionManager.api.openManager()` in the browser console. A dedicated settings/menu UI is planned after V13 live test.

## API
`globalThis.ZFTSessionManager.api` exposes `getActiveSession()`, `listSessions()`, `getSession(id)`, `startSession(name)`, `endSession()`, `resumeSession(id)`, `openManager()`.

Hooks: `zftSessionManager.started`, `zftSessionManager.ended`, `zftSessionManager.resumed`. Payloads are session snapshots. Consumers must validate GM visibility and permissions of their own data.

## Limitations before stable release
- Cross-client GM operation locking is not yet atomic; simultaneous GM submissions could race. Use one active GM when testing.
- No migration from Combat Log's existing one-time sessionStart setting.
- No session-specific Combat Log integration yet.
- No dedicated toolbar/button; dialog offered on GM ready, manual access through API.
- No live Foundry V13 or V14 validation; do not treat this as a production build.

## V13 smoke checks
1. Enable module without Calendaria, confirm manager still starts sessions and warns on Chronicle.
2. With Calendaria enabled, Start New and inspect Chronicle chat message and date formatting.
3. Refresh/reconnect: no duplicate Chronicle; existing session stays active.
4. End; confirm endedAt and activeId null; Resume Selected: no new Chronicle.
5. Log in as player and verify player cannot manage sessions. Test second GM client for concurrency limitation.

No code has been promoted to `main`.
