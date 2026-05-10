# Steam Submission Checklist

This document covers the four manual steps to publish Wisdom & Chance TCG on Steam
after the Electron build is complete. None of these steps require code changes.

---

## Prerequisites

Before starting, you need:
- A completed Windows build (`.exe` / NSIS installer) from `npm run build:win`
- Screenshots of the game (minimum 5, at least 1 must be a real screenshot, not art)
- A short gameplay trailer video (60–90 seconds recommended)
- A Steam partner account at https://partner.steamgames.com

---

## Step 1 — Pay the Steam Direct Fee

1. Log in to https://partner.steamgames.com
2. Click **"Add a new title"** → **"Steam Direct"**
3. Pay the **$100 USD** app submission fee (one-time per game)
4. This fee is fully recouped once the game earns **$1,000 in gross revenue**

> **Tip:** You can have the app in review while building out the store page.
> Payment is what unlocks the ability to submit — it does not immediately publish.

---

## Step 2 — Create a Steamworks App

1. After payment, Valve will assign your game an **App ID** (a unique number like `2847610`)
2. In the Steamworks partner portal, fill in:
   - **App name:** Wisdom & Chance TCG
   - **Default language:** English
   - **App type:** Game
3. Note your **App ID** — you will need it if you later integrate the Steamworks SDK
   for achievements, cloud saves, or the Steam overlay (separate future task)

---

## Step 3 — Upload the Windows Build via SteamPipe

SteamPipe is Steam's build upload tool.

1. Download **SteamCMD** from https://developer.valvesoftware.com/wiki/SteamCMD
2. Create a **depot** for the Windows build in the Steamworks portal
3. Write a **VDF build script** pointing at the folder containing your NSIS installer
   or the unpacked Electron app directory (unpacked is preferred for SteamPipe)
4. Run: `steamcmd +login <username> +run_app_build build.vdf +quit`
5. In the Steamworks portal, go to **Builds** → set the new build as the **Default branch**

> **Mac and Linux:** Repeat this step with the `.dmg` and `.AppImage` outputs,
> adding them as separate depots under the same App ID.

---

## Step 4 — Set Store Page Metadata

In the Steamworks portal under **Store Page**:

| Field | Suggested Content |
|---|---|
| **Short description** | A strategic trading card game of five elemental powers — build your deck, command your army, and battle real opponents in real time. |
| **Full description** | Use the Story section from the Kickstarter guide (`exports/wisdom-chance-kickstarter.pdf`) |
| **Tags** | Card Game, Strategy, Multiplayer, Online PvP, Fantasy |
| **Category** | Multi-player, Single-player (practice mode) |
| **Screenshots** | Minimum 5 — deck builder, game board, card art, shop, leaderboard |
| **Trailer** | Upload your 60–90 second gameplay trailer to YouTube first, then link it |
| **System requirements (min)** | Windows 10, 4GB RAM, broadband internet |
| **System requirements (rec)** | Windows 11, 8GB RAM, broadband internet |
| **Price** | Set your launch price (e.g. Free to Play, or $9.99) |

---

## Step 5 — Submit for Review

1. In the Steamworks portal click **"Submit for review"**
2. Valve reviews new games — typically **3–5 business days**
3. Once approved, set your **release date** and click **Publish**

> Your game goes live on Steam at the scheduled release time. It will appear in
> search, new releases, and be discoverable by the Steam algorithm.

---

## Future: Steamworks SDK Integration

Once the base client is live on Steam, a follow-up task can add native Steam features:

- **Steam Achievements** — map to the existing in-game achievement system
- **Steam Cloud Saves** — sync deck data across devices
- **Steam Overlay** — in-game browser and friend notifications
- **Steam Friends** — invite Steam friends directly to multiplayer rooms

Integration uses the `greenworks` Node.js bindings for the Steamworks C++ SDK.
This is **out of scope** for the initial Steam launch but is a natural next step.
