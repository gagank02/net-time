# net-time

Find tennis courts, pro shops, and hitting partners in Chicago.

```sh
nvm use            # Node 24 LTS
npm ci

# Local database (one-time): Postgres 17 + PostGIS via Homebrew
brew install postgresql@17 postgis && brew services start postgresql@17
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"   # add to ~/.zshrc
npm run db:setup && npm run db:migrate

npm run dev        # http://localhost:5173 (hot reload)
npm run build && npm run preview   # production runtime (workerd) at http://localhost:4173
npm run lint && npm run check && npm test
npm run test:e2e
curl localhost:5173/healthz   # {"status":"ok"}
```
