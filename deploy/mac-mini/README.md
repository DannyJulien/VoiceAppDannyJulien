# Handled on a Mac mini

The Mac mini serves only the static Expo web build. Supabase Edge Functions continue to handle audio, OpenAI, and database operations, so no API key belongs in this folder or in `dist/`.

## Build and serve locally

Run this from the project root after each release:

```zsh
npm ci
npm run build:web
chmod +x deploy/mac-mini/*.sh
./deploy/mac-mini/start-server.sh
./deploy/mac-mini/health-check.sh
```

The server deliberately binds to `127.0.0.1:4173`. It is not reachable from your local network directly. Stop it with:

```zsh
./deploy/mac-mini/stop-server.sh
```

`npm run serve:web` runs the same server in the foreground, which is useful while checking a release manually. `/health` returns JSON with an `ok` status and timestamp.

## Private HTTPS access with Tailscale Serve

Install and sign in to Tailscale on the Mac mini and your phone. With the local server running, use:

```zsh
tailscale serve --https=443 http://127.0.0.1:4173
tailscale serve status
```

Open the private `https://<your-mac>.<your-tailnet>.ts.net` URL printed by Tailscale on your phone. Tailscale Serve terminates HTTPS and proxies only to localhost, so no router port forwarding is required. Disable the route later with:

```zsh
tailscale serve --https=443 off
```

Do not use `tailscale funnel` for this private deployment. Funnel makes a service public.

## Start after a restart

1. Copy `com.myapp.web.plist.example` to `~/Library/LaunchAgents/com.myapp.web.plist`.
2. Replace every `/ABSOLUTE/PATH/TO/Voice App` placeholder and the Node path if your Node installation differs.
3. Create the log folder: `mkdir -p "/ABSOLUTE/PATH/TO/Voice App/deploy/mac-mini/logs"`.
4. Load it: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.myapp.web.plist`.
5. Check: `launchctl print gui/$(id -u)/com.myapp.web` and run `./deploy/mac-mini/health-check.sh`.

To remove it, run:

```zsh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.myapp.web.plist
rm ~/Library/LaunchAgents/com.myapp.web.plist
```

The LaunchAgent runs a foreground Node server and restarts it if it exits. It contains no secrets.

## Public deployment later

Do not forward an HTTP router port. A future public setup needs a custom domain, HTTPS reverse proxy or a carefully configured secure tunnel, authenticated Supabase access, rate limiting, security headers, and backend abuse monitoring. Keep all OpenAI and Supabase service credentials in Supabase Edge Function Secrets.
