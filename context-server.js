// LOCAL DEV TOOL ONLY — never deployed, never bundled into the app, never run
// in CI (see docs/OWNER_LAUNCH_CHECKLIST.md / PHONE_SYNC_SETUP.md). It binds
// to 0.0.0.0 with no authentication and no origin restriction on CORS, and
// its session-log endpoint runs `git commit` with the local process's
// ambient credentials. Anyone on the same network as a running instance can
// read repo task notes and trigger a local commit. Only run this on a
// trusted network (e.g. a private home WiFi you control), never on a public
// or shared network (coffee shop, conference, open office WiFi).
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { execSync } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CONTEXT_DIR = path.join(__dirname, '.claude-context');
const PORT = process.env.PORT || 3333;

// Serve static files (HTML dashboard)
app.use(express.static('public'));

// API: Get all context
app.get('/api/context', (req, res) => {
  try {
    const files = fs.readdirSync(CONTEXT_DIR);
    const context = {};

    files.forEach(file => {
      if (file.endsWith('.md')) {
        context[file] = fs.readFileSync(path.join(CONTEXT_DIR, file), 'utf8');
      }
    });

    res.json({ success: true, data: context });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get specific file
app.get('/api/context/:file', (req, res) => {
  try {
    const filePath = path.join(CONTEXT_DIR, req.params.file);

    // Security: prevent directory traversal
    if (!filePath.startsWith(CONTEXT_DIR)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ success: true, file: req.params.file, content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Update session log (phone feedback)
app.post('/api/context/session-log/append', (req, res) => {
  try {
    const { action, details } = req.body;
    if (!action || !details) {
      return res.status(400).json({ error: 'Missing action or details' });
    }

    const sessionLogPath = path.join(CONTEXT_DIR, 'session-log.md');
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

    const entry = `\n### ${timestamp}\n- **Tool:** Phone/Mobile\n- **Action:** ${action}\n- **Details:** ${details}\n`;

    fs.appendFileSync(sessionLogPath, entry);

    // Auto-commit
    execSync('git add .claude-context/session-log.md && git commit -m "Update context: phone feedback" --no-verify', {
      cwd: __dirname,
      stdio: 'ignore'
    });

    res.json({ success: true, message: 'Logged and committed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Git status
app.get('/api/git/status', (req, res) => {
  try {
    const status = execSync('git status --short', { cwd: __dirname }).toString();
    const lastCommit = execSync('git log -1 --format=%h%n%s', { cwd: __dirname }).toString().trim();

    res.json({
      success: true,
      status: status || 'clean',
      lastCommit: lastCommit
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get IP address for phone access
app.get('/api/device-info', (req, res) => {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  let ipAddress = 'localhost';

  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ipAddress = iface.address;
        break;
      }
    }
  }

  res.json({
    success: true,
    ipAddress,
    port: PORT,
    url: `http://${ipAddress}:${PORT}`
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Context Server Running\n`);
  console.log(
    `⚠️  No authentication — anyone on this network can read repo notes and trigger a git commit.`,
  );
  console.log(`⚠️  Only run this on a trusted, private network (e.g. your home WiFi).\n`);
  console.log(`📱 Phone Access: http://[your-computer-ip]:${PORT}`);
  console.log(`🖥️  Local: http://localhost:${PORT}`);
  console.log(`\n⚡ APIs:`);
  console.log(`   GET /api/context — All context files`);
  console.log(`   GET /api/context/:file — Specific file`);
  console.log(`   POST /api/context/session-log/append — Log phone feedback`);
  console.log(`   GET /api/git/status — Git status\n`);
});
