# Publishing a Monorepo CLI to npm

A research guide for publishing the `agent-canvas` CLI — covering npm publishing, monorepo workflows, Bun-specific tooling, bundling, and versioning.

---

## Table of Contents

1. [Publishing a CLI to npm (Basics)](#1-publishing-a-cli-to-npm-basics)
2. [Publishing from a Monorepo](#2-publishing-from-a-monorepo)
3. [Bun-Specific Publishing](#3-bun-specific-publishing)
4. [Bundling Your CLI (tsup / esbuild)](#4-bundling-your-cli-tsup--esbuild)
5. [package.json Best Practices for CLIs](#5-packagejson-best-practices-for-clis)
6. [Monorepo Versioning with Changesets](#6-monorepo-versioning-with-changesets)
7. [Testing Locally Before Publishing](#7-testing-locally-before-publishing)
8. [Applying This to agent-canvas](#8-applying-this-to-agent-canvas)

---

## 1. Publishing a CLI to npm (Basics)

### Key Steps

1. **Add a shebang** to your entry file: `#!/usr/bin/env node` (or `#!/usr/bin/env bun` for Bun-only CLIs)
2. **Set the `bin` field** in package.json to map command names to executables
3. **Set the `files` field** to whitelist only the files you want published (e.g. `dist/`, `bin/`)
4. **Test locally** with `npm link` or `npm pack`
5. **Publish** with `npm publish` (or `npm publish --access public` for scoped packages)

### Resources

- [npm publish — Official Docs](https://docs.npmjs.com/cli/v8/commands/npm-publish/) — Reference for the publish command, registry configuration, and auth.
- [Building a simple command line tool with npm](https://blog.npmjs.org/post/118810260230/building-a-simple-command-line-tool-with-npm.html) — Official npm blog walkthrough covering `npm init --scope`, shebang, `bin` field, `npm link`, and publishing.
- [Best practices for building CLI and publishing it to NPM](https://webbylab.com/blog/best-practices-for-building-cli-and-publishing-it-to-npm/) — Full lifecycle guide: package structure, argument parsing, error handling, cross-platform compat, and publishing.
- [Publishing a simple CLI tool on NPM](https://schalkneethling.com/posts/publishing-simple-cli-tool-npm/) — Practical step-by-step walkthrough with troubleshooting tips.
- [Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers/) — Modern OIDC-based auth for CI/CD publishing (npm CLI 11.5.1+). Eliminates long-lived tokens.

---

## 2. Publishing from a Monorepo

### The `workspace:*` Problem

During development, package managers resolve `workspace:*` to local packages via symlinks. But npm **cannot** resolve `workspace:*` — you must replace these with real version numbers before publishing.

### Approaches

| Approach               | How it works                                                                    | Best for                                       |
| ---------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| **pnpm / bun publish** | Automatically replaces `workspace:*` with real versions at publish time         | Monorepos using pnpm or bun                    |
| **Changesets**         | Manages versioning, changelogs, and inter-package dependency updates            | Monorepos needing structured release flow      |
| **Bundle everything**  | Inline workspace deps into the CLI's dist via tsup/esbuild, publish one package | Single-package CLIs that consume internal libs |
| **Manual**             | Replace `workspace:*` with `^x.y.z` before each publish                         | Small projects with infrequent releases        |

### Resources

- [Complete Monorepo Guide: pnpm + Workspace + Changesets (2025)](https://jsdev.space/complete-monorepo-guide/) — End-to-end monorepo setup with pnpm workspaces and Changesets. Explains how `workspace:*` is auto-replaced during publish.
- [Workspace | pnpm](https://pnpm.io/workspaces) — Official pnpm docs on workspace protocol support and automatic version replacement.
- [Using npm Workspaces for Monorepo Management](https://earthly.dev/blog/npm-workspaces-monorepo/) — Guide to npm's native workspace feature (npm 7+). Note: npm lacks automatic `workspace:*` replacement, making it less ideal for publishing.
- [A Comprehensive Guide to npm Workspaces and Monorepos](https://leticia-mirelly.medium.com/a-comprehensive-guide-to-npm-workspaces-and-monorepos-ce0cdfe1c625) — Covers workspace setup, dependency management, and publishing strategies.
- [Workspaces and Monorepos in Package Managers (2026)](https://nesbitt.io/2026/01/18/workspaces-and-monorepos-in-package-managers.html) — Comparison of npm, pnpm, and Yarn workspace implementations and publishing behaviors.

---

## 3. Bun-Specific Publishing

### `bun publish`

Bun has a built-in `publish` command that:

- Automatically **strips `workspace:*` and `catalog:` protocols**, replacing them with resolved versions
- Supports 2FA (web and legacy auth via `--auth-type`)
- Reads `NPM_CONFIG_TOKEN` for CI/CD
- Offers `--dry-run` to preview without publishing
- Supports `--tolerate-republish` to avoid errors on duplicate versions

### Bun Shebang

If your CLI uses Bun-specific APIs (`Bun.serve`, `Bun.file`, etc.), use:

```
#!/usr/bin/env bun
```

Users will need Bun installed. For broader compatibility, target Node with `#!/usr/bin/env node`.

### Resources

- [bun publish — Official Docs](https://bun.com/docs/pm/cli/publish) — Complete reference for `bun publish` including workspace protocol handling, auth, and CI/CD setup.
- [Creating an NPM package using Bun](https://github.com/oven-sh/bun/discussions/6034) — Community discussion on package creation and publishing workflow with Bun.
- [Publish a package to npm that can be run with bunx](https://www.api2o.com/en/handbook/bun/publish-executable-to-npm-and-bunx) — Guide to publishing packages designed for `bunx` (Bun's `npx` equivalent).

---

## 4. Bundling Your CLI (tsup / esbuild)

### Why Bundle?

- **Inline workspace dependencies** so you publish a single self-contained package
- **Faster startup** — one file instead of many `require`/`import` hops
- **Smaller install size** — tree-shaking removes unused code
- **No need to publish internal packages** separately

### tsup (Recommended for TypeScript CLIs)

Zero-config TypeScript bundler powered by esbuild:

```bash
# Install
npm install -D tsup

# Basic usage
tsup src/index.ts --format esm --target node18
```

```jsonc
// tsup.config.ts
export default {
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  noExternal: ["@agent-canvas/server", "@agent-canvas/shared"]  // inline workspace deps
}
```

### esbuild (Lower-level, more control)

```bash
esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js
```

### Resources

- [tsup — GitHub](https://github.com/egoist/tsup) — Zero-config TypeScript bundler. Supports ESM/CJS, declaration files, and tree shaking.
- [Using tsup to bundle your TypeScript package](https://blog.logrocket.com/tsup/) — Comprehensive tutorial with config examples for dual ESM/CJS output.
- [Dual Publishing ESM and CJS Modules with tsup](https://johnnyreilly.com/dual-publishing-esm-cjs-modules-with-tsup-and-are-the-types-wrong) — Covers dual-format publishing and validation with "Are the Types Wrong?"
- [esbuild — Getting Started](https://esbuild.github.io/getting-started/) — Official esbuild guide. Use `--platform=node` for CLI tools.
- [esbuild — API Reference](https://esbuild.github.io/api/) — Full API docs for platform, format, bundling, and output configuration.
- [Getting started with esbuild](https://blog.logrocket.com/getting-started-esbuild/) — Practical tutorial covering installation, bundling, and build pipelines.

---

## 5. package.json Best Practices for CLIs

### Essential Fields

```jsonc
{
  "name": "agent-canvas", // unique name on npm
  "version": "0.1.0", // semver
  "type": "module", // ESM by default
  "bin": {
    "agent-canvas": "./dist/index.js", // command → executable mapping
  },
  "files": ["dist", "bin", "web"], // whitelist published files
  "engines": {
    "node": ">=18", // minimum Node version (advisory)
  },
  "keywords": ["cli", "canvas", "tldraw", "agent"],
  "repository": { "type": "git", "url": "..." },
  "license": "MIT",
}
```

### Key Takeaways

| Field     | Purpose                                   | Notes                                                     |
| --------- | ----------------------------------------- | --------------------------------------------------------- |
| `bin`     | Maps CLI commands to executables          | npm creates symlinks (Unix) / .cmd wrappers (Windows)     |
| `files`   | Whitelists files in the published tarball | Safest approach — avoids leaking secrets or test fixtures |
| `engines` | Declares required Node/npm versions       | Advisory by default; enforced with `engine-strict` config |
| `type`    | `"module"` for ESM, omit for CJS          | Determines how `.js` files are interpreted                |

### Resources

- [package.json — Official npm Docs](https://docs.npmjs.com/cli/v7/configuring-npm/package-json/) — Comprehensive reference for all fields.
- [A guide to creating a NodeJS command-line package](https://medium.com/netscape/a-guide-to-create-a-nodejs-command-line-package-c2166ad0452e) — Best practices for `bin` scripts, shebangs, and cross-platform wrappers.
- [How to Use package.json#bin to create a CLI](https://sergiodxa.com/tutorials/use-package-json-bin-to-create-a-cli) — Deep dive into `bin` for single and multi-command CLIs.
- [Files & Ignores — npm/cli Wiki](https://github.com/npm/cli/wiki/Files-&-Ignores) — Explains interaction between `files`, `.npmignore`, and `.gitignore`.
- [Publishing what you mean to publish](https://blog.npmjs.org/post/165769683050/publishing-what-you-mean-to-publish.html) — Use `npm pack` to verify contents before publishing. Always use `files` whitelist.

---

## 6. Monorepo Versioning with Changesets

### What is Changesets?

A tool for managing versioning and changelogs in monorepos. The workflow:

1. **Add a changeset** — `npx changeset` — developers describe what changed and the semver bump type
2. **Version** — `npx changeset version` — consumes changesets, bumps versions, updates changelogs, fixes inter-package deps
3. **Publish** — `npx changeset publish` — publishes changed packages to npm and creates git tags

### Quick Setup

```bash
npm install -D @changesets/cli
npx changeset init          # creates .changeset/ directory
npx changeset               # add a changeset
npx changeset version       # bump versions
npx changeset publish       # publish to npm
```

### CI/CD Automation

The [Changesets GitHub Action](https://github.com/changesets/action) can:

- Automatically open a "Version Packages" PR when changesets land on main
- Publish to npm when that PR is merged

### Resources

- [Changesets — Official Documentation](https://changesets-docs.vercel.app/) — Full docs covering workflow, config, prerelease, and snapshot releases.
- [changesets/changesets — GitHub](https://github.com/changesets/changesets) — Source repo with guides on independent vs fixed versioning, linked packages, and more.
- [changesets/action — GitHub Action](https://github.com/changesets/action) — Automates version PRs and npm publishing in CI.
- [Introducing Changesets: Simplify Project Versioning](https://lirantal.com/blog/introducing-changesets-simplify-project-versioning-with-semantic-releases) — Practical intro comparing Changesets to Lerna.
- [Guide to version management with changesets](https://blog.logrocket.com/version-management-changesets/) — Step-by-step tutorial with multi-package examples.

---

## 7. Testing Locally Before Publishing

### `npm pack` (Recommended)

Creates a `.tgz` file that mimics what npm will actually publish:

```bash
cd apps/cli
npm pack --dry-run   # preview contents without creating the tarball
npm pack             # creates agent-canvas-0.1.0.tgz
```

Install the tarball in a test project to verify:

```bash
npm install /path/to/agent-canvas-0.1.0.tgz
```

### `npm link`

Creates a global symlink for live development testing:

```bash
cd apps/cli
npm link                    # creates global symlink
agent-canvas --help         # test the CLI
npm unlink -g agent-canvas  # clean up
```

### `bun link`

Bun's equivalent:

```bash
cd apps/cli
bun link                    # register the package
bun link agent-canvas       # use it in another project
```

### Resources

- [Using npm link for Local Package Development](https://schalkneethling.com/posts/using-npm-link-for-local-package-development/) — How to set up and use `npm link` for real-time testing.
- [How To Test NPM Packages Locally](https://www.jamesqquick.com/blog/how-to-test-npm-packages-locally/) — Compares `npm link`, `npm pack`, and `yalc` for local testing.

---

## 8. Applying This to agent-canvas

### Current State

```
agent-canvas-monorepo (private, not published)
├── packages/shared    → @agent-canvas/shared   (workspace:*)
├── packages/server    → @agent-canvas/server   (workspace:*, depends on shared)
└── apps/cli           → agent-canvas           (depends on server + shared)
```

**Issues to fix:**

- `bin/run.js` uses `#!/usr/bin/env bun` and imports TypeScript directly
- `workspace:*` deps must be resolved before publishing
- Server package uses `@types/bun` — may contain Bun-specific APIs

### Recommended Path: `bun publish`

Since the project already uses Bun throughout, the simplest path:

1. **Fix `bin/run.js`** to import compiled JS:

   ```js
   #!/usr/bin/env bun
   import "../dist/index.js";
   ```

2. **Build everything**: `bun run build && bun run bundle:web`

3. **Publish in order** (bun auto-resolves `workspace:*`):
   ```bash
   cd packages/shared && bun publish --access public
   cd packages/server && bun publish --access public
   cd apps/cli && bun publish
   ```

### Alternative: Bundle + Single Package

If you'd rather publish only the CLI:

1. Add `tsup` and configure it to inline `@agent-canvas/server` and `@agent-canvas/shared`
2. Remove workspace deps from `dependencies`
3. Update `bin` to point to the bundled output
4. Publish just `agent-canvas`

---

## Quick Reference

| Task                                      | Command                                            |
| ----------------------------------------- | -------------------------------------------------- |
| Preview published files                   | `npm pack --dry-run`                               |
| Test CLI locally                          | `npm link` or `bun link`                           |
| Publish (npm)                             | `npm publish --access public`                      |
| Publish (bun, auto-resolves workspace:\*) | `bun publish --access public`                      |
| Add a changeset                           | `npx changeset`                                    |
| Bump versions                             | `npx changeset version`                            |
| Publish with changesets                   | `npx changeset publish`                            |
| Dry run publish                           | `npm publish --dry-run` or `bun publish --dry-run` |
