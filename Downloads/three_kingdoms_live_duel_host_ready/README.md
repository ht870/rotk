# Three Kingdoms — Live Duel (multiplayer MVP)

## Run

```bash
node server.js
```

Open http://localhost:3000 on two browsers (or access your server LAN IP from another device). Both players use the same room code; one chooses Wei and one Shu. For public play, deploy to a Node.js host with an always-on instance. **Cloudflare Pages static-only is not enough for this Node server.**

## Implemented
- 15-city map with Wei/Shu/Wu ownership; two human factions (Wu neutral)
- Immediate server-ordered recruit, develop, fortify, attack, transfer
- Server-authoritative room state and live polling every 700 ms
- Timer 20/60/180/300 seconds; all End Turn or timeout advances turn
- Turn income and food upkeep; action log, enemy troop approximations

## Not implemented
- Integration with v2.4.6 combat/hero engine, real hero skills, battle reports, city sprites
- Persistent storage, authentication, true fog-of-war, concurrency-safe database transactions, reconnect identity, spectators
- GPT-6 agent control (requires separate browser automation or paid API)
- Secure deployment: this prototype trusts faction selection, so use only with friends for testing

This is a separate playable network prototype, **not** a complete conversion of the existing offline v2.4.6 game.

## GET API for ChatGPT experiment

- `GET /api/state?code=CAOCAO&side=shu`
- `GET /api/action?code=CAOCAO&side=shu&type=recruit&city=6`
- `GET /api/action?code=CAOCAO&side=shu&type=attack&from=6&to=1&troops=2000` (only if adjacent and legal)
- `GET /api/end?code=CAOCAO&side=shu`

These GET commands change game state. Only use in a disposable test room; GET links may be prefetched or repeated. ChatGPT's web reader may not actually execute state-changing requests.

## Deploy to Render

Push these files to a GitHub repo. Create a Render **Web Service** (Node), build command `npm install`, start command `npm start`, instance count 1. Render supplies `PORT`. After deploy, open your `https://...onrender.com` URL. Free instances may sleep or reset RAM state; use for tests only.
