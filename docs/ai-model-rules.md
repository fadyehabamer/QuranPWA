# AI Model Rules for QuranPWA

This file defines strict working rules for AI coding assistants contributing to this repository.

## 1. Project Structure Rules
- Keep HTML pages in the repository root.
- Keep shared JavaScript in js/.
- Keep page-specific scripts in js/page-scripts/.
- Keep shared CSS in css/styles.css.
- Keep page-specific CSS in css/page-styles/.
- Keep JSON data in data/.
- Keep icons in assets/icons/.

## 2. Frontend Editing Rules
- Do not add inline script blocks inside HTML files.
- Do not add inline style blocks inside HTML files unless explicitly requested.
- Reuse existing classes and variables before introducing new ones.
- Preserve RTL behavior and Arabic-first UX.
- Preserve responsive behavior for mobile and desktop.
- Avoid visual regressions in header, hero section, bottom nav, and sidebar.

## 3. Naming Rules
- Use clean descriptive names for page scripts:
  - index.js, quran.js, quran-data.js, azkar.js, settings.js, etc.
- Do not use generated suffix names like inline1 or inline2 in final code.
- Keep naming lowercase with hyphen when needed.

## 4. Path and Reference Rules
- When moving or renaming files, update all references in:
  - HTML script/link tags
  - js/sw.js pre-cache list
  - data/manifest.json if related assets change
  - vercel.json when deployment headers/path rules are affected
- Never leave stale paths after refactors.

## 5. Religious Content Safety Rules
- Do not modify Quran text, surah metadata, or azkar content unless explicitly requested.
- If edits are requested for religious text, keep exact wording and encoding intact.
- Prefer non-content changes (layout, UX, performance, structure) unless content edits are the task.

## 6. Performance and PWA Rules
- Keep service worker cache versioning consistent after shell-path changes.
- Do not cache live audio stream endpoints in the service worker.
- Avoid unnecessary heavy dependencies for simple UI behavior.

## 7. Quality Gate (Required Before Finish)
- Ensure no inline scripts remain in HTML:
  - Search for script tags without src.
- Ensure no broken references after renames.
- Run diagnostics/lint checks and resolve introduced errors.
- Smoke-test critical pages:
  - Home, Quran, Azkar, Prayer Times, Settings, Bookmarks.

## 8. Change Discipline
- Keep patches focused and minimal.
- Do not reformat unrelated code.
- Do not revert user edits unless explicitly asked.
- If unexpected conflicting changes appear in touched files, stop and ask the user how to proceed.

## 9. Documentation Rules
- If behavior changes, update README/docs briefly.
- Add short rationale comments only where logic is non-obvious.
- Prefer concise, maintainable documentation.
