# ZFT Session Manager

**Foundry V13 development build:** `0.1.0-dev.2`

Separate GM-confirmed session lifecycle service for ZFT modules. Does not require ZFT Tools or Combat Log.

## Available functionality

- Start a named session (name defaults to real-world date) after GM confirmation.
- End an active session or resume an ended session.
- Persist session ID, name, start/end timestamps, creator and Chronicle status in a world setting.
- Prompt the designated active GM on login when no session is open, unless disabled in settings.
- Open session manager manually through **Configure Settings → Module Settings → ZFT Session Manager → Open Session Manager**.
- Inspect recent session history from the management dialog.
- Post Calendaria Chronicle v1.6.0 (same visual/date/time rules) to normal chat on **new** session start; never on resume/refresh.
- If Calendaria is disabled or errors, keep the session active and warn the GM. Announcement is not automatically retried.

## Shared API

`globalThis.ZFTSessionManager.api` exposes `getActiveSession()`, `listSessions()`, `getSession(id)`, `startSession(name)`, `endSession()`, `resumeSession(id)`, `openManager()`.

Hooks: `zftSessionManager.started`, `zftSessionManager.ended`, `zftSessionManager.resumed`. Consumers must enforce visibility controls for their own data.

## Limitations

This is a test build, not a verified production release. GM coordination is **not transactionally locked across clients**; two GMs acting at the exact same time could race. Use one GM for initial tests. Chronicle's `attempted` state is saved before creating the chat message, avoiding normal reconnect duplicates, but an interrupted write can leave ambiguous delivery requiring manual inspection. The module has no automatic import of Combat Log's old session timestamp, nor automatic Combat Log or ZFT Tools integration.

## Test plan

1. Enable in Foundry V13 with Calendaria enabled. Sign in as GM with no active session. Verify the session dialog appears.
2. Start a named session. Check that exactly one Chronicle message appears in ordinary Chat, and the session is listed as Active.
3. Refresh and reconnect. Verify no repeat Chronicle and the session remains active.
4. Open Module Settings → Session Manager. End session, inspect history, resume it. Verify resume does not post Chronicle.
5. End and start a different session: verify a fresh Chronicle and two historical records.
6. Disable Calendaria. Start another session and ensure the session is still created but warns about Chronicle.
7. Connect as player: check they cannot use the GM-only manager actions.

**Do not promote to `main` until live V13 tests and GM/player visibility tests pass.**

## dev.3 updates
The management window is a custom ZFT-themed application (available from the module settings menu and via `ZFTSessionManager.api.openManager()`). Confirming the end of a session sends a separate Calendaria Chronicle chat message labelled SESSION ENDS; start messages are labelled SESSION BEGINS. Both announcements use Calendaria's current in-game time. Resume does not announce. Legacy sessions from dev.2 are kept; their end-chronicle field is added when next ended. Chat post attempts are reserved before sending and never automatically retried after an uncertain failure.

## Launcher and minimize (dev.4)

GM-only Session Manager control appears in Foundry Scene Controls under Token tools. Click to toggle the dashboard. Window header Minimize collapses its content; click Restore to expand it. This does not end or change the session. Integration is self-contained, so ZFT Tools is optional.

## ZFT Tools integration (dev.5)
When ZFT Tools 0.1.0-dev.8 is active, Session Manager contributes a GM-only calendar action inside the existing ZFT Tools control group using `zft-tools.collectTools`. It toggles the dashboard. The standalone Token Scene Controls action is used only when ZFT Tools is not enabled. Neither launcher ends the game session when its window closes.
