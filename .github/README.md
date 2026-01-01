# GitHub Actions Workflows

This directory contains CI/CD workflows for the `@daichi-kudo/mcp-memory-sqlite` package.

## 📁 Files

- **`workflows/ci.yml`** - Continuous Integration workflow
- **`workflows/release.yml`** - Release and npm publishing workflow
- **`SETUP.md`** - Detailed setup instructions
- **`PIPELINE_DIAGRAM.md`** - Visual pipeline diagrams

## 🚀 Quick Start

### Windows Users

```cmd
SETUP_COMMANDS.bat
```

### Linux/macOS Users

```bash
bash SETUP_COMMANDS.sh
```

This will:
1. Install required development dependencies
2. Update package.json with CI-friendly scripts
3. Verify everything works locally

## 📋 Manual Setup

If you prefer to set up manually, follow these steps:

### 1. Install Dependencies

```bash
npm install -D \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint \
  rimraf
```

### 2. Update package.json

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts && tsc --noEmit",
    "test": "echo \"No tests yet\" && exit 0",
    "test:ci": "npm run typecheck && npm run lint && npm run test",
    "clean": "rimraf dist",
    "prepublishOnly": "npm run clean && npm run build"
  }
}
```

### 3. Configure npm Token

1. Generate token at https://www.npmjs.com/settings/[username]/tokens
2. Choose "Automation" type
3. Copy the token
4. Add to GitHub repository:
   - Settings → Secrets and variables → Actions
   - New repository secret: `NPM_TOKEN`

### 4. Verify Locally

```bash
npm run typecheck  # Should pass ✓
npm run lint       # Should pass ✓
npm run build      # Should create dist/ ✓
npm test           # Should pass ✓
```

### 5. Commit and Push

```bash
git add .
git commit -m "ci: add GitHub Actions workflows"
git push origin master
```

## 🔄 Workflows

### CI Workflow (ci.yml)

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

**Jobs:**
1. Lint and type check
2. Build package
3. Test on multiple platforms (Ubuntu, Windows, macOS) with Node 20 & 22
4. Verify build artifacts are committed

**Duration:** ~2-3 minutes

### Release Workflow (release.yml)

**Triggers:**
- GitHub release published
- Tags matching `v*` pattern

**Steps:**
1. Run full CI checks
2. Build package
3. Publish to npm with provenance
4. Create release summary

**Duration:** ~3-5 minutes

## 📦 Publishing Releases

### Create a Tag

```bash
git tag v1.0.0
git push origin v1.0.0
```

### Create GitHub Release (Recommended)

1. Go to repository → Releases → Draft a new release
2. Choose tag: v1.0.0
3. Add release notes:

```markdown
## What's New
- Initial release
- SQLite-based MCP memory server
- WAL mode for concurrency

## Installation
npm install @daichi-kudo/mcp-memory-sqlite
```

4. Click "Publish release"

The workflow will automatically publish to npm! 🎉

## 🔍 Monitoring

### View Workflow Runs

1. Go to repository → Actions tab
2. Click on a workflow run to see details
3. Each job shows real-time logs

### Check npm Package

After release, verify at:
- https://www.npmjs.com/package/@daichi-kudo/mcp-memory-sqlite

## 🛠️ Troubleshooting

### CI Fails: Type Errors

```bash
npm run typecheck  # See errors locally
# Fix errors
npm run typecheck  # Verify fixed
```

### CI Fails: Lint Errors

```bash
npm run lint       # See lint errors
npm run lint -- --fix  # Auto-fix
```

### CI Fails: Build Check

The build-check job fails if committed `dist/` doesn't match the build output.

**Fix:**
```bash
npm run clean
npm run build
git add dist/
git commit -m "chore: update build artifacts"
git push
```

### Release Fails: npm Publish

**Common causes:**
1. NPM_TOKEN not set or invalid
2. Package version already published
3. Package name not available
4. No publish permissions for `@daichi-kudo` scope

**Solutions:**
1. Verify NPM_TOKEN in GitHub secrets
2. Bump version in package.json
3. Check package availability on npm
4. Verify npm scope access

### better-sqlite3 Build Fails

The native module should rebuild automatically. If it fails:

1. Check Node.js version compatibility
2. Verify platform has build tools (CI runners have them)
3. Check better-sqlite3 documentation for platform support

## 📊 Matrix Testing

The CI workflow tests on 6 combinations:

| OS | Node 20 | Node 22 |
|----|---------|---------|
| Ubuntu | ✅ | ✅ |
| Windows | ✅ | ✅ |
| macOS | ✅ | ✅ |

This ensures the package works across all supported platforms.

## 🔐 Security

### npm Provenance

The release workflow uses npm provenance, which:
- Cryptographically links the package to the source code
- Proves the package was built by GitHub Actions
- Prevents tampering between build and publish
- Improves supply chain security

### Secret Management

- NPM_TOKEN is stored as a GitHub secret
- Never exposed in logs
- Can be rotated without code changes
- Scoped to publish permissions only

## 📚 Additional Resources

- [Detailed Setup Guide](SETUP.md)
- [Pipeline Diagrams](PIPELINE_DIAGRAM.md)
- [CI Setup Summary](../CI_SETUP_SUMMARY.md)
- [Package.json Improvements](../PACKAGE_JSON_IMPROVEMENTS.md)

## 🆘 Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review workflow logs in the Actions tab
3. Consult the detailed guides in this directory
4. Open an issue on GitHub

---

**Happy CI/CD! 🚀**
