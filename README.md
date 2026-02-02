# Cheesy Parts

Cheesy Parts is a web-based system for tracking parts through the design and manufacture cycle. It assigns part numbers with which CAD files can be saved to version control and stores information about parts' current manufacturing status.

Originally created by [FRC Team 254](https://www.team254.com/), modernized by [FRC Team 1310](https://www.team1310.ca/).

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query
- **Backend:** Hono (TypeScript) on Cloudflare Workers
- **Database:** PostgreSQL via Supabase
- **Deployment:** Cloudflare (Workers for API, Pages for frontend)

## Development

### Prerequisites

- Node.js 18+
- npm
- A Supabase project (free tier works)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/cheesy-parts.git
   cd cheesy-parts
   ```

2. Install dependencies:
   ```bash
   npm install
   npm run install:all
   ```

3. Configure environment variables:

   Copy `backend/.dev.vars.example` to `backend/.dev.vars` and fill in:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-key
   AUTH_SECRET=your-random-secret-key-here
   DATABASE_URL=postgresql://...
   FRONTEND_URL=https://your-domain.com  # For CORS (defaults to localhost:5173)
   RESEND_API_KEY=your_api_key  # Optional, for email notifications
   ADMIN_EMAIL=admin@example.com  # Optional
   ```

4. Run database migrations:
   ```bash
   npm run migrate
   ```

5. Start the development servers:
   ```bash
   npm run dev
   ```

   This runs both the API (port 8787) and frontend (port 5173) concurrently.

### Commands

```bash
npm run dev              # Start both API and frontend dev servers
npm run dev:api          # Start only the API server
npm run dev:frontend     # Start only the frontend server
npm run build            # Build the frontend for production
npm run deploy           # Deploy both API and frontend to Cloudflare
npm run migrate          # Run database migrations
npm run migrate:status   # Check migration status
npm run migrate:create   # Create a new migration file
```

## Deployment

The application deploys to Cloudflare:

- **API:** Cloudflare Workers
- **Frontend:** Cloudflare Pages

GitHub Actions workflows in `.github/` handle automatic deployments on push to main.

To deploy manually:
```bash
npm run deploy
```

You'll need to configure Wrangler with your Cloudflare account and set the production environment variables in the Cloudflare dashboard.

## Project Structure

```
cheesy-parts/
├── backend/           # Hono API (Cloudflare Workers)
│   ├── src/
│   │   └── index.ts   # All API routes
│   ├── wrangler.toml  # Cloudflare Workers config
│   └── .dev.vars      # Local environment variables (not committed)
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilities and API client
│   └── vite.config.ts
├── database/          # Supabase PostgreSQL migrations
│   ├── migrations/    # SQL migration files
│   └── migrate.js     # Migration runner
└── .github/           # GitHub Actions workflows
```

## Part Numbering

Parts auto-generate numbers based on project prefix:
- **Assemblies:** `PREFIX-A-####` (increments by 100)
- **Parts:** `PREFIX-P-####` (increments by 1)

For example, in a project with prefix "2024", assemblies would be numbered 2024-A-100, 2024-A-200, etc., while parts would be 2024-P-1, 2024-P-2, etc.

## Security

- **Password requirements:** 8+ characters with uppercase, lowercase, and number
- **Rate limiting:** Login attempts limited to 5 per 60 seconds per IP
- **CORS:** Restricted to configured `FRONTEND_URL`
- **Token validity:** 14 days
- **Password hashing:** PBKDF2-SHA256 with 100,000 iterations

## Contributing

If you have a suggestion for a new feature, create an issue on GitHub or submit a pull request.

## License

See [COPYING](COPYING) for license information.
