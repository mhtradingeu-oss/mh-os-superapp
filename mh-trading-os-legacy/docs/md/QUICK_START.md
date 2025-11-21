# Quick Start Guide
**دليل البدء السريع**

## The npm scripts issue

The npm scripts documented in `NPM_SCRIPTS.md` need to be manually added to `package.json`. Until then, use the direct commands below.

## Running Tests / تشغيل الاختبارات

### Option 1: Use the helper script (easiest)
```bash
./run-tests.sh
```

### Option 2: Run directly
```bash
npx jest server/__tests__/smoke-tests.test.ts --testTimeout=10000 --forceExit
```

## Type Checking / فحص الأنواع

```bash
npx tsc --noEmit
```

## Code Quality / جودة الكود

```bash
# Lint
npx eslint . --max-warnings 0

# Format check
npx prettier --check "**/*.{ts,tsx,js,jsx,json,css,md}"

# Format (auto-fix)
npx prettier --write "**/*.{ts,tsx,js,jsx,json,css,md}"
```

## All Quality Checks / جميع فحوصات الجودة

```bash
npx tsc --noEmit && npx eslint . --max-warnings 0 && npx prettier --check "**/*.{ts,tsx,js,jsx,json,css,md}"
```

## Development / التطوير

```bash
npm run dev    # Already works!
npm run build  # Already works!
```

---

## Adding npm Scripts to package.json

To make the commands shorter, manually add these to your `package.json` "scripts" section:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc",
    
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,css,md}\"",
    
    "test": "jest",
    "test:smoke": "jest server/__tests__/smoke-tests.test.ts --testTimeout=10000 --forceExit",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    
    "quality": "npm run typecheck && npm run lint && npm run format:check",
    
    "db:push": "drizzle-kit push"
  }
}
```

Then you can use:
```bash
npm test
npm run quality
npm run lint:fix
# etc.
```

---

**For full documentation, see:** `README_DEV.md`
