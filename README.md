# Beat Windows

A single-page browser game and meme site: one hammer, one computer that is always "installing updates". Smash every pop-up before the desktop blue-screens.

Live at [beatwindows.org](https://beatwindows.org).

## Gameplay

- 30-second rounds; tap/click a pop-up window to smash it.
- Pop-ups spawn faster over time and pile up.
- More than 8 pop-ups on screen triggers a BSOD and ends the run.
- Survive the full 30 seconds to win.

## Tech

Plain HTML/CSS/JS in a single file — no build step, no dependencies.

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Deploy

Hosted on GitHub Pages with the custom domain `beatwindows.org` (`CNAME`). Push to the default branch to deploy.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Entire site: styles, markup, and game logic |
| `CNAME` | GitHub Pages custom domain |
| `.nojekyll` | Disables Jekyll processing on GitHub Pages |

## Disclaimer

Pure parody. Memecoin, not financial advice. It can go to zero — only spend what you can afford to lose.
