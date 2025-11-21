# Required NPM Scripts Configuration

## Scripts to Add to package.json

Add these scripts to the `"scripts"` section of `package.json`:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,css,md}\"",
    
    "test": "NODE_ENV=test jest",
    "test:watch": "NODE_ENV=test jest --watch",
    "test:coverage": "NODE_ENV=test jest --coverage",
    
    "quality": "npm run typecheck && npm run lint && npm run format:check",
    
    "db:push": "drizzle-kit push"
  }
}
```

## Usage Instructions

### Quality Checks (Run before committing)
```bash
npm run quality
```

### Type Checking
```bash
npm run typecheck
```

### Linting
```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

### Formatting
```bash
# Format all files
npm run format

# Check if files are formatted
npm run format:check
```

### Testing
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Configuration Files Created

- ✅ `eslint.config.js` - ESLint configuration
- ✅ `.prettierrc` - Prettier configuration  
- ✅ `.prettierignore` - Prettier ignore patterns

## Dependencies Installed

- ✅ `prettier` - Code formatter
- ✅ `typescript-eslint` - TypeScript ESLint plugin
- ✅ `@eslint/js` - ESLint JavaScript plugin
- ✅ `pino` - Logger (for Task 4)
- ✅ `pino-pretty` - Pretty logger output
