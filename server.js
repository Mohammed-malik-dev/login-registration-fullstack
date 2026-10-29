const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const SESSION_SECRET = process.env.SESSION_SECRET;

if (IS_PRODUCTION && (!SESSION_SECRET || SESSION_SECRET.length < 32)) {
  console.error("Set SESSION_SECRET to a random string of at least 32 characters in production.");
  process.exit(1);
}

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new sqlite3.Database(path.join(dataDir, "app.sqlite"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

app.disable("x-powered-by");
if (IS_PRODUCTION) app.set("trust proxy", 1);

app.use(helmet({
  // The frontend uses Google Fonts and Font Awesome CDNs.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: IS_PRODUCTION ? [] : null
    }
  }
}));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

app.use(session({
  name: "auth.sid",
  secret: SESSION_SECRET || "development-only-change-this-secret-before-deploying",
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({
    db: "sessions.sqlite",
    dir: dataDir,
    concurrentDB: true
  }),
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PRODUCTION,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "محاولات كثيرة. حاول مرة أخرى بعد 15 دقيقة." }
});

function normalizeUsername(value) {
  return typeof value === "string" ? value.trim() : "";
}
function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function validUsername(username) {
  return /^[a-zA-Z0-9_.-]{3,24}$/.test(username);
}
function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}
function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 72;
}
function publicUser(row) {
  return { id: row.id, username: row.username, email: row.email, createdAt: row.created_at };
}
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "يجب تسجيل الدخول أولاً." });
  }
  next();
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/register", authLimiter, async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body.username);
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!validUsername(username)) {
      return res.status(400).json({
        error: "اسم المستخدم يجب أن يكون من 3 إلى 24 حرفاً، ويحتوي على أحرف إنجليزية أو أرقام أو . _ - فقط."
      });
    }
    if (!validEmail(email)) {
      return res.status(400).json({ error: "أدخل بريداً إلكترونياً صحيحاً." });
    }
    if (!validPassword(password)) {
      return res.status(400).json({ error: "كلمة المرور يجب أن تكون بين 8 و72 حرفاً." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    db.run(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, passwordHash],
      function (err) {
        if (err) {
          if (err.code === "SQLITE_CONSTRAINT" || String(err.message).includes("UNIQUE")) {
            return res.status(409).json({ error: "اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل." });
          }
          return next(err);
        }

        req.session.regenerate((sessionErr) => {
          if (sessionErr) return next(sessionErr);
          req.session.userId = this.lastID;
          req.session.save((saveErr) => {
            if (saveErr) return next(saveErr);
            res.status(201).json({
              message: "تم إنشاء الحساب وتسجيل الدخول بنجاح.",
              user: { id: this.lastID, username, email }
            });
          });
        });
      }
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/login", authLimiter, (req, res, next) => {
  const login = typeof req.body.login === "string" ? req.body.login.trim() : "";
  const password = req.body.password;

  if (!login || typeof password !== "string" || !password) {
    return res.status(400).json({ error: "أدخل اسم المستخدم أو البريد الإلكتروني وكلمة المرور." });
  }

  db.get(
    "SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
    [login, login],
    async (err, row) => {
      if (err) return next(err);
      const passwordMatches = row && await bcrypt.compare(password, row.password_hash);
      if (!passwordMatches) {
        return res.status(401).json({ error: "بيانات تسجيل الدخول غير صحيحة." });
      }

      req.session.regenerate((sessionErr) => {
        if (sessionErr) return next(sessionErr);
        req.session.userId = row.id;
        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          res.json({ message: "تم تسجيل الدخول بنجاح.", user: publicUser(row) });
        });
      });
    }
  );
});

app.get("/api/me", requireAuth, (req, res, next) => {
  db.get(
    "SELECT id, username, email, created_at FROM users WHERE id = ?",
    [req.session.userId],
    (err, row) => {
      if (err) return next(err);
      if (!row) {
        return req.session.destroy(() => res.status(401).json({ error: "الحساب غير موجود." }));
      }
      res.json({ user: publicUser(row) });
    }
  );
});

app.post("/api/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("auth.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PRODUCTION
    });
    res.json({ message: "تم تسجيل الخروج." });
  });
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "المسار غير موجود." });
  res.status(404).send("Page not found");
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "حدث خطأ في الخادم. حاول مرة أخرى لاحقاً." });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

function shutdown() {
  db.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
