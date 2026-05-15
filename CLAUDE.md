## gstack
Use /browse from gstack for all web browsing.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, 
/plan-design-review, /review, /investigate, /careful, /freeze, /guard, 
/unfreeze, /qa, /ship, /learn, /retro, /autoplan, /cso, /document-release.

Run /careful at the start of every session.
Run /learn at the end of every session.
Run /retro at the end of every day.

# Wird — وِرد | Claude Code Context

**Date:** May 2026  
**Developer:** Hifza Zafar · Karachi, Pakistan  

## Stack — ALWAYS USE THESE EXACT VERSIONS
- Expo SDK 54
- React Native 0.81.5
- TypeScript 5.x (strict mode)
- Node.js 20+
- Expo Router v6
- React Native Reanimated 4.x
- Supabase JS v2
- Zustand 4.5.x

## Hard Rules — READ BEFORE ANY CODE
- NEVER use `expo-permissions` — deprecated since Expo 46
  Use built-in module permissions (expo-av, expo-camera, etc.)
- NEVER use class components — always functional with hooks
- NEVER import CSS or use web stylesheet APIs
- ALWAYS check npm for latest stable compatible version before installing
- ALWAYS run `npx expo-doctor` if dependency issues arise
- Android-ONLY for V1. Do not write iOS-specific code.
- Dark mode ONLY for V1.

## App Identity and Naming
App name: **Wirdd** (double d — matches domain wirdd.app)
Folder: wirdd-v1
app.json name: "Wirdd" | app.json slug: "wirdd" | Bundle ID: app.wirdd.android
Note: Arabic وِرد uses one d. Only the Latin brand spelling uses double d.

Wirdd is a passive dhikr tracker. Voice detects "Astaghfirullah" on-device
using Porcupine. Session-based foreground service. Like a step counter for
Islamic remembrance. No tapping. No buttons. Say it — Wirdd counts it.

## Key Technical Decisions
- Porcupine NOT full speech-to-text (too heavy, wrong tool)
- Foreground Service keeps session alive on locked screen (legal Android pattern)
- Offline-first: SQLite local, Supabase sync on session end (Pro only)
- No audio stored anywhere — binary detection only (detected/not detected)
- Pinned notification = Pro feature only

## Feature Gates Summary
FREE: voice detection, counter, manual +1, today total, 7-day chart, streak, qalb week view
PRO: pinned notification, multiple phrases, annual heatmap, time ring, personal bests,
     insight cards, heart map, mood breakdown, CSV export, cloud backup, nastaliq font

## Supabase Tables
- profiles (id, email, is_premium, plan, active_phrase)
- sessions (id, user_id, local_id, started_at, ended_at, count, phrase_id, mood)
- daily_summaries (id, user_id, date, total_count, session_count, peak_period, dominant_mood)

## Design System
Fonts: Amiri (Arabic), Cormorant Garamond (display/counter), DM Sans (UI)
Primary color: #C8A84B (dark mode gold)
Background: #080910
Surface: #0D0F1A

## Payment
Paddle → Payoneer → local bank
$14.99 one-time Pro unlock, no subscription
WebView-based Paddle checkout (no native SDK)
Supabase Edge Function receives Paddle webhook → sets is_premium = true

## Build
Beta: `eas build --profile preview --platform android`  (APK → direct download)
Prod: `eas build --profile production --platform android` (AAB → Play Store)