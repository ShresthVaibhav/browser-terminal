# browser-terminal

Access your Linux server from any browser. No SSH client, no VPN, no bullshit.

![auth](https://img.shields.io/badge/auth-password%20%2B%20magic%20link-blue) ![session](https://img.shields.io/badge/session-1h%20idle%20%2F%203h%20max-orange) ![stack](https://img.shields.io/badge/stack-node%20%2B%20xterm.js-green) ![license](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What is this

A self-hosted web app that gives you a real terminal in the browser, connected to a live shell on your server. Built for situations where you need to get into your server but don't have an SSH client — phone, library computer, someone else's laptop, whatever.

It is not a web SSH wrapper around someone else's infrastructure. Everything runs on your own server. No accounts, no cloud relay, no third party sees your traffic.

---

## How the auth works

Getting in requires two things:

1. **Password** — entered on the login page. Stored as a bcrypt hash, never in plaintext.
2. **Magic link** — if the password is correct, a one-time link gets emailed to you. It expires in 5 minutes and self-destructs the moment you click it. Even if someone intercepts the email after you've clicked, the link is already dead.

Once you're in, you get a full bash shell — not a UI that looks like a terminal, an actual shell with real command execution.

Sessions kill themselves after **1 hour of no keyboard input** or **3 hours from login**, whichever comes first. After that you go through the full auth flow again.

---

## Security

- Password verified with bcrypt — no plaintext storage anywhere
- Magic link tokens are UUID v4, single-use, 5 minute TTL, stored only in server memory
- Rate limited to 5 login attempts per 15 minutes per IP
- Session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`
- Every auth event (attempts, logins, logouts, expirations) logged locally with timestamp + IP
- Optional Telegram notification on successful login
- No third-party auth, no analytics, no telemetry — 100% self-hosted

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js, Express |
| Terminal | node-pty (real PTY), xterm.js (frontend) |
| Transport | WebSocket (ws library) |
| Auth | bcrypt, nodemailer, UUID magic links |
| Deployment | nginx reverse proxy, systemd, Let's Encrypt |

---

## Setup

### Requirements

- Linux server (Ubuntu 22.04 recommended)
- Node.js v18+
- A domain pointed at your server
- Gmail account with an [App Password](https://myaccount.google.com/apppasswords)

```bash
sudo apt install -y nodejs build-essential python3
```

### Install

```bash
git clone https://github.com/ShresthVaibhav/browser-terminal.git
cd browser-terminal
npm install
```

### Configure

```bash
cp .env.example .env
nano .env
```

**Generate your password hash:**
```bash
node -e "require('bcrypt').hash('yourpassword', 12).then(console.log)"
```
Paste the output as `PASSWORD_HASH` in `.env`.

**Generate a session secret:**
```bash
openssl rand -hex 64
```
Paste as `SESSION_SECRET`.

**Gmail App Password:** Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), create one for "Mail", paste the 16-char code (no spaces) as `SMTP_PASS`.

### Run locally

```bash
node server.js
# open http://localhost:3001
```

Set `APP_URL=http://localhost:3001` in `.env` while testing locally.

---

## Deploy on a server

```bash
# 1. Create directory
sudo mkdir -p /opt/browser-terminal
sudo chown $USER:$USER /opt/browser-terminal
git clone https://github.com/ShresthVaibhav/browser-terminal.git /opt/browser-terminal
cd /opt/browser-terminal
npm install --omit=dev

# 2. Configure
cp .env.example .env
nano .env  # fill everything in, set APP_URL=https://yourdomain.com

# 3. systemd service
sudo cp browser-terminal.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now browser-terminal
sudo systemctl status browser-terminal  # should say active (running)

# 4. nginx
sudo cp nginx.conf.example /etc/nginx/sites-available/browser-terminal
# open it and replace yourdomain.com with your actual domain
sudo ln -s /etc/nginx/sites-available/browser-terminal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5. TLS (free via Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Done. Open `https://yourdomain.com`.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PASSWORD_HASH` | yes | bcrypt hash of your login password |
| `SESSION_SECRET` | yes | random 64-char string for signing tokens |
| `SMTP_HOST` | yes | SMTP server (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | yes | SMTP port (`465` for SSL) |
| `SMTP_USER` | yes | your email address |
| `SMTP_PASS` | yes | app password (not your regular password) |
| `SMTP_FROM` | yes | from address shown in emails |
| `MAGIC_LINK_TO` | yes | email to receive magic links |
| `APP_URL` | yes | public URL of your app (no trailing slash) |
| `PORT` | no | port to listen on (default: `3001`) |
| `TELEGRAM_BOT_TOKEN` | no | bot token for login notifications |
| `TELEGRAM_CHAT_ID` | no | your Telegram chat ID |

---

## Logs

Every auth event is appended to `auth.log`:

```
2026-06-23T01:08:14Z | SUCCESS        | 1.2.3.4 | magic link sent
2026-06-23T01:08:31Z | MAGIC_USED     | 1.2.3.4 | session=abc123
2026-06-23T02:08:31Z | SESSION_EXPIRED| 1.2.3.4 | reason=idle
```

```bash
tail -f /opt/browser-terminal/auth.log
```

---

## Author

Built by a developer with a focus on self-hosted infrastructure, security tooling, and backend systems.

Got a bug, question, or just want to chat — reach out:

- Site: [shresthvaibhav.in](https://shresthvaibhav.in)
- Telegram: [@Tamsy_Caine](https://t.me/Tamsy_Caine)

---

## License

MIT
