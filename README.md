# Login & Registration — Full Stack

A responsive login/registration app with an Express backend, SQLite database, hashed passwords, and server-side sessions.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

1. Extract the project ZIP.
2. Open a terminal in the project directory.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a long session secret. For example, run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` in your terminal.
5. Set the environment variable `SESSION_SECRET` to the generated value. For local development, you can also copy `.env.example` to `.env`, but Node does not automatically load `.env` in every version/configuration. If you use a `.env` file, install and configure `dotenv`, or set environment variables in your terminal.
6. Start the server:

   ```bash
   npm start
   ```

7. Open `http://localhost:3000`.

The server creates `data/app.sqlite` and a SQLite session store automatically on first run.

### Set environment variables

**macOS/Linux**
```bash
export SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
npm start
```

**Windows PowerShell**
```powershell
$env:SESSION_SECRET = node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm start
```

For local development only, the app has a fallback session secret. Always set a strong `SESSION_SECRET` in production.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/register` | Create account and sign in |
| `POST` | `/api/login` | Sign in using username or email |
| `GET` | `/api/me` | Return current signed-in user |
| `POST` | `/api/logout` | Sign out and destroy session |
| `GET` | `/api/health` | Health check |

## Push to GitHub

Create a repository, then upload the project files and folders. Do **not** upload `node_modules`, `.env`, or the generated `data/` folder. Those are excluded by `.gitignore`.

You can also use Git:

```bash
git init
git add .
git commit -m "Build full-stack authentication app"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your repository's actual URL.

## Deployment notes

GitHub Pages only hosts static files; it cannot run this Express server or SQLite database. Deploy the **entire Node.js project** to a Node-compatible hosting service that supports persistent disk storage, then set `NODE_ENV=production` and a strong `SESSION_SECRET` in the host's environment variables. SQLite needs persistent storage; if your host has ephemeral filesystems, use a managed database instead.

When running behind HTTPS in production, the app sets secure session cookies. Keep the frontend and API on the same origin unless you intentionally configure CORS and cookie settings.

## Security and limitations

- Passwords are hashed with bcrypt; raw passwords are not stored.
- SQL statements use parameterized queries.
- Sessions are stored server-side in SQLite, with `HttpOnly`, `SameSite=Lax` cookies.
- Helmet adds HTTP security headers.
- Login and registration endpoints have rate limiting and input validation.
- Set a strong secret and use HTTPS in production.
- Social sign-in buttons are placeholders and are not connected to Google/Facebook/GitHub/LinkedIn.
- Password reset email flow is not implemented yet.
- This is a starter project; review your hosting, backup, monitoring, and privacy requirements before using it for real users.
