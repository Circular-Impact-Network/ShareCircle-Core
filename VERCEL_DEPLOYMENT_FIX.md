# Vercel Deployment Fix for Prisma Error

## Issue
`Prisma Client could not locate the Query Engine for runtime "rhel-openssl-3.0.x"`

## Solution Steps

### 1. Commit Your Migrations
Your migrations are currently untracked. Commit them to git:

```bash
git add prisma/migrations/
git commit -m "Add Prisma migrations"
```

### 2. Verify Environment Variables on Vercel
Make sure you have set `DATABASE_URL` in your Vercel project settings:
- Go to your project on Vercel Dashboard
- Navigate to Settings → Environment Variables
- Add `DATABASE_URL` with your PostgreSQL connection string
- Make sure it's available for all environments (Production, Preview, Development)

### 3. Add NEXTAUTH_URL and NEXTAUTH_SECRET
Also ensure these are set:
- `NEXTAUTH_URL` - Your deployment URL (e.g., https://your-app.vercel.app)
- `NEXTAUTH_SECRET` - A random secret string (generate with: `openssl rand -base64 32`)

### 4. Clear Vercel Cache and Redeploy

**Option A: Via Vercel Dashboard**
1. Go to your project on Vercel
2. Go to Settings → General
3. Scroll down and click "Clear Build Cache"
4. Then go to Deployments and redeploy the latest deployment

**Option B: Via Vercel CLI**
```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login
vercel login

# Redeploy with no cache
vercel --prod --force
```

### 5. If Still Having Issues

If the error persists, try adding this to your `package.json` in the root:

```json
{
  "prisma": {
    "schema": "prisma/schema.prisma"
  }
}
```

And ensure your `next.config.ts` includes:

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma']
  }
}
```

### 6. Alternative: Use Prisma Data Proxy (if you continue having issues)

As a last resort, you can use Prisma Data Proxy:
1. Create a Data Proxy connection on Prisma Cloud
2. Update your schema.prisma:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // Direct connection for migrations
}
```

## Why This Happens

Vercel uses AWS Lambda which runs on Amazon Linux 2. The Prisma Client needs to be generated with the correct binary target (`rhel-openssl-3.0.x`) for this environment. Your schema already has the correct `binaryTargets` configured, but the build process needs to run properly.

## Current Configuration Status

✅ `binaryTargets` configured correctly in schema.prisma
✅ `postinstall` script set to run `prisma generate`
✅ `build` script includes `prisma generate`
✅ Prisma is in dependencies (not devDependencies)
✅ vercel.json cleaned up

The issue is likely due to:
- Migrations not being committed
- Vercel's build cache
- Environment variables not properly set

