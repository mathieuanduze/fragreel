# FragReel — Privacy Policy

_Last updated: 2026-04-27_

FragReel ([fragreel.gg](https://fragreel.gg)) is a free, open-source tool that turns Counter-Strike 2 demo files into shareable highlight videos. This document explains exactly what data we touch and what we don't.

**TL;DR**: we don't track you, we don't sell anything about you, and your gameplay videos never leave your computer unless you explicitly choose to share them.

---

## What we DO process

### 1. Steam account info (login only)
When you sign in via Steam, we receive your **public Steam ID** and your Steam display name. That's the entire Steam OAuth handshake — no email, no friends list, no game library, no payment info. We use the Steam ID to associate your match selections with your account so you see your own demos when you return.

### 2. Match metadata (numeric, anonymous)
After your local FragReel client parses a `.dem` file, it sends to our server a **JSON document** containing:
- map name (e.g. `de_inferno`)
- match score (e.g. `15-5`)
- per-round event timing (kill ticks, weapon names, headshot flags, bomb plant/defuse ticks)
- aggregate stats (K/D, headshot percentage, ADR, rating)
- in-game name extracted from the demo (needed to lock the spectator camera at render time)

This metadata lets the server score the most cinematic rounds and tell the client which segments to capture. It does **not** include video, audio, voice chat, or anything that identifies real-world people other than what Steam IDs already do.

### 3. Render selection
When you pick which highlights to render, your selection (highlight ranks, mood preset, music toggle, x-ray toggle, scoreboard toggle, output orientation) is sent to your local client to generate the video.

---

## What we DO NOT do

### No analytics
There is **zero** third-party analytics on the website or in the desktop client. No Google Analytics, no Mixpanel, no Amplitude, no Sentry, no Hotjar, no Facebook Pixel. You can verify this in our public source code.

### No tracking cookies
The website uses a single session cookie for Steam authentication. No advertising cookies, no fingerprinting, no cross-site tracking.

### No video upload
Your gameplay video — the MP4 your computer renders — is **never uploaded** to our servers or anywhere else. It stays on your local disk. You decide if and where to share it.

### No demo upload (raw `.dem` files)
The raw demo files you store in your CS2 demos folder are parsed **locally on your machine**. Only the numeric match metadata described above leaves your computer. The `.dem` file itself never travels to our servers.

### No selling or sharing of data
We do not sell your data. We do not share your data with advertisers, brokers, or third parties. We do not use your data to train any AI model.

---

## Where data is stored

- **Match metadata**: stored on a [Railway](https://railway.app) backend (PostgreSQL-equivalent storage), encrypted in transit (HTTPS) and at rest. Tied to your Steam ID.
- **Steam authentication tokens**: stored in a JWT cookie in your browser (signed, with a short expiry). Never sent to any third party.
- **Your generated videos**: only on your local computer. We never see them.

---

## Open source verification

Anyone can audit the exact data flows:

- Web frontend + server API + editor: [github.com/mathieuanduze/fragreel](https://github.com/mathieuanduze/fragreel)
- Desktop client: [github.com/mathieuanduze/fragreel-client](https://github.com/mathieuanduze/fragreel-client)

Both repos are under the MIT license. If you find a privacy claim above that doesn't match the code, please open an issue and we'll either fix the code or fix this document — whichever is wrong.

---

## Data deletion

You can request deletion of all account data at any time by emailing `mathieuanduze@me.com` from the email associated with your Steam account, or by opening a GitHub issue. Within 30 days we'll remove your Steam ID and any associated match metadata from our database.

Account data deletion does **not** affect any videos you have already generated, since those live only on your computer.

---

## Children

FragReel is not directed at children under 13. If you're a parent or guardian and you believe your child has signed in with a Steam account, contact `mathieuanduze@me.com` and we'll remove the data.

---

## Changes to this policy

If we ever change what data we collect, we'll update this file and bump the "Last updated" date at the top. Significant changes will also be announced on the project's GitHub releases.

---

## Contact

- Email: `mathieuanduze@me.com`
- GitHub: [@mathieuanduze](https://github.com/mathieuanduze)
- Issues: [github.com/mathieuanduze/fragreel/issues](https://github.com/mathieuanduze/fragreel/issues)
