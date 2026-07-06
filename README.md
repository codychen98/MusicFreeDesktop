# MusicFree Desktop (fork)

This repository is a fork of [maotoumao/MusicFreeDesktop](https://github.com/maotoumao/MusicFreeDesktop). Upstream docs, license (AGPL 3.0), plugins, and themes still apply unless noted below.

## Android companion (WebDAV auto-sync)

For a **compatible Android build** with **WebDAV backup and optional auto-sync** (same idea as this desktop fork), use **[codychen98/MusicFree](https://github.com/codychen98/MusicFree)**. Install from that repo's releases, configure the **same WebDAV server** on both desktop and phone, then enable sync where it fits your workflow. See that README for mobile-specific steps.

## Disclaimer

This fork is provided **as-is**. You are solely responsible for how you use it: complying with laws and licenses, choosing trustworthy plugins and remote backup targets, and protecting credentials (including WebDAV passwords stored in local settings). The authors and contributors **disclaim liability** for data loss, security incidents, third‑party services, or any damages arising from use or misuse.

---

## How this fork differs from upstream

**Features**

- **`musicfree://player` deep links** — External apps or shortcuts can send playback/control URLs when MusicFree is running (second instance / OS URL handlers). Supported paths (after `musicfree://player/`): `skipnext`, `skipprev`, `toggleplay`, `favorite`, `unfavorite`, `favoritetoggle`, `togglelyric`. Example: `musicfree://player/toggleplay`
- **Desktop lyrics** — Multiple-line desktop lyric display and an LX-style scrollable lyric list; stability fixes for dragging and Windows.
- **AutoSync using WebDAV** — Backup/restore from **Settings → Backup** (server URL, username, password). Optional **auto-sync** pulls remote state on startup when configured and can coordinate with local edits. **Webdav is treated as source of truth, songs don't exist in webdav backup will also be deleted locally.**
- **Built-in remote music storage** — WebDAV and pCloud API are configured once under **Settings → Backup** (credentials, music library path, auto-sync). Browse, play, download, and backup use the built-in **WebDAV** source; an external WebDAV plugin is optional and ignored if installed.
- **Playlists sidebar** — Per-playlist track counts, drag-and-drop reorder, and behavior tuned alongside WebDAV ordering.

