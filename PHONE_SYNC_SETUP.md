# 📱 Phone Sync Setup
**Connect your phone to Claude Code + Chrome context**

---

## 1. Install Dependencies

```bash
cd /home/user/Shams
npm install express cors
```

## 2. Start the Context Server

```bash
node context-server.js
```

**Output will show:**
```
🚀 Context Server Running

📱 Phone Access: http://[your-computer-ip]:3333
🖥️  Local: http://localhost:3333
```

## 3. Access from Phone

### Option A: Same WiFi Network
1. Open terminal on your computer, run:
   ```bash
   hostname -I
   ```
   Copy the **first IP** (e.g., `192.168.1.100`)

2. On your **phone browser**, go to:
   ```
   http://192.168.1.100:3333
   ```

### Option B: USB/Same Machine
   ```
   http://localhost:3333
   ```

### Option C: Find IP Automatically
The server prints it when you start:
```
📱 Phone Access: http://192.168.1.100:3333
```

---

## 4. What Your Phone Can See

| Tab | Purpose |
|-----|---------|
| 📋 **Task** | Current work, blockers, next steps |
| 💾 **Changes** | Code changes waiting for review |
| 🔮 **Oracle** | RKP decisions & audit trail |
| 📝 **Log** | Activity log (Claude Code, Chrome, Phone) |
| 💬 **Feedback** | Log findings from phone |

---

## 5. How to Use from Phone

### Read Mode
1. Open dashboard on phone
2. Tap tabs to read current work
3. Auto-refreshes every 30 seconds

### Write Mode (Feedback)
1. Go to **💬 Feedback** tab
2. Enter:
   - **Action:** What you did (Testing, Code Review, etc.)
   - **Details:** What you found
3. Tap **✅ Submit & Sync**
4. Phone logs it → Auto-commits to Git → Claude Code reads it

---

## Example Workflow

```
Phone                    Server               Claude Code / Chrome
  |                         |                         |
  ├─ Opens :3333            |                         |
  ├─ Reads current task      |                         |
  ├─ Tabs: changes, oracle   |                         |
  │                          |                         |
  ├─ Tests something    ────>├─ Logs to session-log.md|
  │                          ├─ Commits & pushes ────>| Pulls & reads
  │                          |                         |
  │<─ Gets confirmation ─────┤                        |
  │   (✅ Synced)            |                    Next commit
  |
```

---

## 6. Network Security Note

⚠️ **The server runs on `0.0.0.0` (all interfaces) with no authentication and
no CORS origin restriction.** It's accessible from:
- Same WiFi: ✅ Yes
- Local machine: ✅ Yes
- Outside networks: ❌ No (unless port-forwarded)

Anyone on the same network as a running instance can read every file under
`.claude-context/` and hit `POST /api/context/session-log/append`, which runs
`git commit` with your local process's credentials. **Only run this on a
trusted, private network you control (e.g. your home WiFi) — never on a
public or shared network** (coffee shop, conference, open office WiFi,
hotel/airport WiFi).

**Further hardening (do before running on any network you don't fully trust,
or before wider use):**
- Only run when actively testing; stop it otherwise
- Use a firewall to block port 3333 externally
- Change `PORT` in `context-server.js` to a random number
- Consider adding a shared-secret header check before treating this as safe
  for anything beyond a solo developer's own home network

---

## 7. Troubleshooting

### "Connection refused"
- Is server running? Check terminal for `🚀 Context Server Running`
- Is phone on same WiFi? Verify IP matches

### "Cannot read POST"
- Server may have crashed → restart `node context-server.js`
- Check git is installed and `.git` folder exists

### "Git commit failed"
- Make sure you've done `git config user.name` and `git config user.email`
- Check `.git/hooks/post-commit` exists and is executable

---

## 8. Keeping It Running

**Option 1: Background process (development)**
```bash
nohup node context-server.js > context-server.log 2>&1 &
```

**Option 2: systemd (permanent)**
```ini
[Unit]
Description=Shams Context Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/user/Shams
ExecStart=/usr/bin/node context-server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

**Option 3: Docker**
```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install express cors
EXPOSE 3333
CMD ["node", "context-server.js"]
```

---

## 9. API Endpoints (Advanced)

If you want to integrate with other tools:

```bash
# Get all context
curl http://localhost:3333/api/context

# Get specific file
curl http://localhost:3333/api/context/current-task.md

# Log feedback (POST)
curl -X POST http://localhost:3333/api/context/session-log/append \
  -H "Content-Type: application/json" \
  -d '{"action":"Testing","details":"Oracle responds correctly"}'

# Git status
curl http://localhost:3333/api/git/status
```

---

## 10. Quick Start (TL;DR)

```bash
# 1. Install
npm install express cors

# 2. Run
node context-server.js

# 3. On phone, open:
#    http://192.168.1.[your-computer-last-ip]:3333

# 4. Read context, log feedback
# 5. Done! Auto-syncs to Git
```

---

**Now you have 3-way sync:**
- ✅ Claude Code (this session)
- ✅ Claude Chrome (web)
- ✅ Your Phone (dashboard)

**All connected. All synced. One Oracle.**
