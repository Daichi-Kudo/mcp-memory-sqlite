# GitHub Actions Setup Guide

## Overview

Two workflows have been created:

1. **ci.yml** - Runs on every push and PR
2. **release.yml** - Publishes to npm on release/tag

## Setup Steps

### 1. npm Token

For `release.yml` to work, you need to add your npm token to GitHub:

1. Generate an npm token at https://www.npmjs.com/settings/[username]/tokens
   - Choose "Automation" token type
   - Copy the token

2. Add to GitHub repository:
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: paste your npm token
   - Click "Add secret"

### 2. Update package.json Scripts

Before pushing, update your `package.json` with the recommended scripts from `PACKAGE_JSON_IMPROVEMENTS.md`:

```json
"scripts": {
  "build": "tsc",
  "start": "node dist/index.js",
  "dev": "tsx src/index.ts",
  "typecheck": "tsc --noEmit",
  "lint": "tsc --noEmit",
  "test": "echo \"No tests yet\" && exit 0",
  "clean": "rm -rf dist",
  "prepublishOnly": "npm run clean && npm run build"
}
```

### 3. Commit and Push

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflows"
git push origin master
```

### 4. Publishing a Release

When ready to publish:

**Option A: GitHub Release (Recommended)**
```bash
git tag v1.0.0
git push origin v1.0.0
```

Then create a release on GitHub:
- Go to repository → Releases → Draft a new release
- Choose the tag v1.0.0
- Add release notes
- Publish release

**Option B: Direct Tag Push**
```bash
git tag v1.0.0
git push origin v1.0.0
```

The `release.yml` workflow will automatically:
- Run type checking
- Run linting
- Run tests
- Build the package
- Publish to npm with provenance

## Workflow Details

### CI Workflow (`ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Jobs:**

1. **lint-and-typecheck**
   - Runs TypeScript type checking
   - Runs linting (currently same as typecheck)

2. **build**
   - Builds the package
   - Uploads build artifacts for 7 days

3. **test** (Matrix)
   - Tests on Ubuntu, Windows, and macOS
   - Tests with Node.js 20 and 22
   - Rebuilds better-sqlite3 (native module)
   - Runs tests
   - Tests binary execution

4. **build-check**
   - Ensures committed dist/ is up to date
   - Fails if build output differs from committed files

### Release Workflow (`release.yml`)

**Triggers:**
- GitHub release published
- Tags matching `v*` pattern

**Steps:**
1. Type checking
2. Linting
3. Building
4. Testing
5. Verifying package contents
6. Publishing to npm with provenance
7. Creating GitHub release summary

**Features:**
- Uses npm provenance for supply chain security
- Automatically extracts version from package.json
- Creates detailed release summary
- Publishes as public scoped package

## Verifying Setup

### Test CI Locally

Before pushing, verify scripts work:

```bash
npm run typecheck  # Should pass
npm run lint       # Should pass
npm run build      # Should create dist/
npm test           # Should pass (currently just echoes)
```

### Check Workflows After Push

1. Go to repository → Actions tab
2. You should see the CI workflow running
3. Click on the workflow run to see details
4. All jobs should pass ✓

## Troubleshooting

### better-sqlite3 Build Failures

If the native module fails to build in CI:

- Check Node.js version compatibility
- Ensure build tools are available (the workflow uses standard runners which have build tools)
- The workflow includes `npm rebuild better-sqlite3` step

### Test Failures

Currently tests just echo success. When you add real tests:

1. Update the `test` script in package.json
2. Tests will automatically run in CI
3. Tests run on all platforms (Linux, Windows, macOS)

### Permission Errors During Publish

If npm publish fails:

1. Verify NPM_TOKEN is set correctly in GitHub secrets
2. Ensure token has "Automation" or "Publish" permissions
3. Check package name is available on npm
4. Verify you have permissions to publish under `@daichi-kudo` scope

### Build Check Failures

If `build-check` job fails:

1. Run `npm run build` locally
2. Commit the updated dist/ folder
3. The workflow ensures committed build artifacts are always up to date

## Next Steps

1. ✅ Add npm token to GitHub secrets
2. ✅ Update package.json scripts
3. ✅ Commit and push workflows
4. ⏳ Add real tests (see PACKAGE_JSON_IMPROVEMENTS.md for test setup)
5. ⏳ Consider adding ESLint for better linting
6. ⏳ Create your first release

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [npm Provenance](https://docs.npmjs.com/generating-provenance-statements)
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
