# AI Agent Context File: Privacy Policy Architecture

Hello fellow AI Agent! If you have been summoned to this repository to assist the user, please read this entire document carefully. It contains the critical operational logic, historical bugs, and architectural quirks of this Markdown-to-HTML automated deployment pipeline. 

Your fundamental directive is to maintain the simplicity of this system for non-technical human maintainers, who will **only** ever upload or edit `.md` files inside the `Markdowns/` directory via the GitHub web interface.

---

## 🏗️ Core Architecture

This repository operates on a completely automated static-site generation pipeline relying on GitHub Actions.

1. **`scripts/generate.js`**: The core converter script. It runs `markdown-it` over the `Markdowns/` directory. It converts documents, maps relative links natively securely, purges "ghost/orphaned" HTML files, and strictly rewrites `README.md` endpoints between automated `<!-- AUTO-FILE-LIST-START -->` markers.
2. **`.github/workflows/generate-and-deploy.yml`**: The CI/CD pipeline triggers on file pushes. It strictly sets up a `_site/` staging container (copying only `Html/` and `assets/`), auto-commits the generated HTML directly back to the repo, and deploys locally hosted CSS natively to GitHub Pages.

---

## 🧨 Critical "Gotchas" (Do Not Break These)

The following components were painstakingly designed to resolve specific edge-cases. **Do not remove or "simplify" them.**

### 1. The MathJax Auto-Commit Conflict
The `generate.js` script employs `markdown-it-mathjax3` to render LaTeX natively. MathJax dynamically inserts random Hexadecimal IDs into the generated HTML. 
**If you (the AI) or a developer run `node scripts/generate.js` locally and attempt to push the generated HTML, you will trigger a Git race condition.** The GitHub Action will also run the script and push back. The overlapping random Mathematical IDs *will* cause a fatal pull conflict. 
👉 **Fix:** Never bother committing `Html/` manually. If you break the tree locally, run `git reset --hard origin/main` to absorb the bot's auto-composed HTML structure.

### 2. Relative Link Injection Bug
When authors write `[Link Name](./Some File name with Spaces.md)`, `markdown-it` parser natively breaks quietly and drops the anchor string because of the un-encoded spaces. 
👉 **Fix:** `generate.js` employs a specific *Pre-Processing RegExp* hook that scans the raw markdown string and dynamically injects `%20` over local paths *before* hitting the parser.

### 3. Parentheses & Markdown Failure
Standard JavaScript `encodeURIComponent()` spares characters like `(` and `)`, which completely destroys Markdown link syntax if a file is named `Privacy Policy (Draft).md`.
👉 **Fix:** We use a custom `safeEncode()` wrapper natively mapped over the script specifically designed to catch URI character components missing from strict RFC 3986 bounds.

### 4. Local Styling / Fallback
We don't inject CDNs directly in the HTML headers because offline accessibility was a requirement.
👉 **Fix:** CSS assets are pathed relatively `../assets/`. Inside the Actions YAML, we programmed a safe `curl` script fallback that actively downloads `github-markdown.css` and `highlight.js` elements and bundles them directly into the staging artifact should the `assets/` tracking ever accidentally be deleted by a human user.

### 5. `npm` Lockfile Fallbacks
Using strict `npm ci` crashes entirely if a user accidentally drops the `package-lock.json`. 
👉 **Fix:** The Action YAML utilizes a conditional `if [ -f package-lock.json ]; then npm ci; else npm install; fi` structure.

---

## 🛠️ Modifying the Markdown Engine
If the user requests additional syntax (diagrams, youtube embeddings, etc.), you will need to:
1. `npm install` the accompanying `markdown-it-*` plugin.
2. Edit `scripts/generate.js` natively wrapping it inside `.use()` clauses.
3. Commit both the `generate.js` payload and the `package.json`/`package-lock.json` directly. The GitHub Action will handle regenerating the downstream cache endpoints automatically. 

Good luck. Stay focused, and protect the deployment container!
