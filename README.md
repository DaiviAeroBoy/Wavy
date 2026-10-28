# Wavy

Offline music and video player (Material 3 look, wavy seek bar). One app, two builds:

- **Windows app** (Electron): installer, portable exe, saved library folders, MP3 downloads with yt-dlp.
- **Web build**: the same `app/index.html`, hosted on GitHub Pages. No downloads or saved folders (browser limits).

## Get the Windows exe (automatic)
1. Create a new GitHub repo and push this folder to the `main` branch.
2. Open the repo's **Actions** tab. Every push to `main` builds and publishes a Release with
   `Wavy-Setup-x.x.x.exe`, `Wavy-Portable-x.x.x.exe` and a web zip.
3. For the web build: **Settings > Pages > Source: GitHub Actions**.

## Run locally
`npm install` then `npm start`. Build exes yourself with `npm run dist`.

## Downloads
Paste a link in **Play link** and press **Download MP3**. Wavy uses `yt-dlp`/`ffmpeg` if they are on your PATH, otherwise it
fetches them from GitHub once. YouTube also needs a JavaScript runtime: Wavy uses Deno if installed, else its built-in Node.
If a download fails after YouTube changes something, delete `%APPDATA%\Wavy\bin` to refresh yt-dlp. Files go to `Music\Downloaded Songs`.
Windows SmartScreen may warn about the unsigned exe: choose More info > Run anyway.
