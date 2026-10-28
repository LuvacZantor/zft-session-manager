# Changelog

## 0.1.0-dev.5 (2026-10-27)
- Integrated GM-only Session Manager toggle into existing ZFT Tools group using the supported collection hook.
- Suppressed duplicate standalone toolbar action when ZFT Tools is active.
- Retained standalone launcher as optional fallback and existing minimize/restore behavior.
- Added ZFT Tools as a recommended, not required, module.
- Live Foundry V13 verification pending.


## 0.1.0-dev.4 (2026-10-27)
- Added GM-only left Scene Controls button to toggle Session Manager without navigating Module Settings.
- Added window minimize/restore control; closing and minimizing never end an active session.
- No direct changes to ZFT Tools module (repository does not contain installed module implementation).

## 0.1.0-dev.3
- ZFT-themed custom Session Manager dashboard replaces generic Foundry dialogs.
- Chronicle announces the Calendaria date/time at both confirmed session start and end.
- Start and end Chronicle results are recorded separately in persistent session metadata.
- Existing session lifecycle, resume and API retained.
- Live Foundry V13 validation pending.


## 0.1.0-dev.2 (2026-10-27)
- Added Module Settings management entry to access Start/End/Resume without console commands.
- Compact management dialog with active-session status, editable name, resume list, recent history.
- Retained embedded Calendaria Chronicle 1.6.0 appearance and optional dependency.
- Saved Chronicle attempt marker before posting, to avoid reconnect duplicates.
- Preserved shared session API and lifecycle hooks.
- Foundry V13 live validation pending; no remote GitHub changes for this build.

## 0.1.0-dev.1 (2026-10-27)
- Initial development baseline on `develop` with persistent session history and shared API.
