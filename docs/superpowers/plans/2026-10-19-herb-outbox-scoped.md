# Herb Outbox and Scoped Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a session-backed read-later list using ReActionView Outbox and enable Herb `<style scoped>` for the article list in the local Rails experiment.

**Architecture:** Keep saved stable article IDs in the Rails cookie session and resolve them through `ContentRepository`. Use Outbox for optimistic additions and ordinary Rails forms for no-JavaScript and removal flows; only add optimistic removal if the pinned runtime proves a supported mechanism. Register Herb's scoped-style visitor and Lightning CSS dependency for the existing article-list partial.

**Tech Stack:** Rails 8.1, Herb and ReActionView pinned Git SHAs, Rails cookie session, ReActionView slots/Outbox, Lightning CSS, Minitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-herb-outbox-scoped-design.md`

## Global Constraints

- Work only in the `experiment/herb` branch and `experiments/herb/` unless a shared spec/plan document is being updated.
- Do not deploy to Cloudflare.
- Preserve the Astro application, existing post bodies, slugs, and public URLs.
- Keep add/remove usable through ordinary HTML forms without JavaScript.
- Store article IDs only; resolve content from `ContentRepository` at render time.
- Keep each Outbox form and its destination collection inside the same Herb template region.
- Do not assume undocumented Outbox removal APIs; prove them against the pinned ReActionView runtime.

## Review Focus

- Empty saved-list first addition: test that Outbox has a supported template source and that the row resolves to its server key.
- Invalid or stale article IDs: test they are ignored and cannot be persisted through the endpoint.
- Cookie session capacity: test the chosen saved-item cap and visible full-list response.
- CSRF and request format: test Outbox slots response and normal HTML redirect behavior.
- CSS scoping: assert the generated response contains scoped selectors and no CSS changes leak into unrelated templates.

---

### Task 1: Prove empty-list Outbox row creation

**Files:**
- Create: `tests/e2e/herb-outbox-template.spec.ts`
- Inspect: `experiments/herb/app/assets/javascripts/reactionview.esm.js`
- Inspect: pinned ReActionView source and tests in the local Bundler checkout

**Interfaces:**
- Consumes: pinned ReActionView `74b565e178e67d575e17f1cfa558eeb695c38641` runtime.
- Produces: a passing test proving a supported empty-collection template strategy, or a documented blocker requiring spec revision before proceeding.

- [x] **Step 1: Add a browser assertion for the empty collection template**

Render the article-list partial with zero rows and assert the pinned runtime has a parked row template for its compiled collection slot.

- [x] **Step 2: Run the focused browser test**

Run: `bun run test:e2e:herb -- --grep "item template for an empty collection"`
Expected: PASS if the pinned runtime parks a row template; fail before feature work otherwise.

- [x] **Step 3: Confirm the implementation path**

The pinned client's `rowTemplate` first reads parked item statics (`itemStaticsKey(slot.index)`), then falls back to a rendered row. The empty article collection has parked statics already, so no fixture markup or product change is needed.

- [x] **Step 4: Run the focused browser test**

Run: `bun run test:e2e:herb -- --grep "item template for an empty collection"`
Expected: PASS; Task 3 will verify Outbox creates a visible row from this template.

---

### Task 2: Add session-backed read-later endpoints

**Files:**
- Modify: `experiments/herb/config/routes.rb`
- Modify: `experiments/herb/app/controllers/articles_controller.rb` or create a focused saved-articles controller
- Create: `experiments/herb/app/services/saved_articles.rb`
- Modify: `experiments/herb/test/integration/content_test.rb` or create `experiments/herb/test/integration/saved_articles_test.rb`

**Interfaces:**
- Consumes: `ContentRepository#articles` and stable article `id` values.
- Produces: a service that validates, caps, adds, removes, and resolves session article IDs; POST endpoints with HTML fallback responses. Task 3 completes the Outbox slots response after its target collection exists.

- [x] **Step 1: Write failing tests for valid, invalid, stale, and capped IDs**

Assert that only known article IDs are stored, stale session IDs are omitted during resolution, repeated adds do not duplicate entries, removal is idempotent, and the cap is enforced with an observable message.

- [x] **Step 2: Run the focused tests**

Run: `cd experiments/herb && bin/rails test test/integration/saved_articles_test.rb`
Expected: FAIL because the service and endpoints do not exist.

- [x] **Step 3: Implement session storage and HTML POST routes**

Keep only stable IDs in `session`; cap at twenty IDs and expose whether an add succeeded or the cap was reached. Support redirects for ordinary HTML forms and keep Rails CSRF protection enabled. Add the slots response alongside the destination collection in Task 3.

- [x] **Step 4: Run the focused integration tests**

Run: `cd experiments/herb && bin/rails test test/integration/saved_articles_test.rb`
Expected: PASS for validation, cap, idempotency, and HTML redirects/not-found behavior.

---

### Task 3: Render read-later controls and collection

**Files:**
- Modify: `experiments/herb/app/views/articles/index.html.erb`
- Modify: `experiments/herb/app/views/articles/_article_list.html.erb`
- Create: `experiments/herb/app/views/articles/_saved_articles.html.erb` if a separate collection is needed
- Modify: `experiments/herb/app/controllers/articles_controller.rb`
- Modify: `experiments/herb/test/integration/saved_articles_test.rb`
- Modify: `tests/e2e/blog.spec.ts` or add a Herb-specific spec

**Interfaces:**
- Consumes: saved-article service and the passing Outbox template strategy from Task 1.
- Produces: keyed saved-list rows, add/remove forms, and Outbox slot confirmations rendered through the same row partial.

- [x] **Step 1: Add failing view tests for saved and empty states**

Assert that article rows expose add controls, saved articles render with stable keys and remove controls, and the empty state contains a valid Outbox template without a fake saved article.

- [x] **Step 2: Add failing browser coverage for optimistic add and persistence**

Assert the row appears before the POST response is released, then remains after server confirmation and reload; test remove and HTML form fallback.

- [x] **Step 3: Run focused Rails and browser tests to confirm failure**

Run: `cd experiments/herb && bin/rails test test/integration/saved_articles_test.rb`
Run: `bun run test:e2e:herb -- --grep "read-later"`
Expected: FAIL because the controls and saved-list UI do not exist.

- [x] **Step 4: Implement keyed collection, forms, and slots response**

Use the confirmed Outbox template strategy. Re-render the canonical saved row from the same partial in the slots response so the temporary key is replaced by the stable content ID. If a supported removal action exists, prove and use it; otherwise preserve the normal POST redirect flow.

- [x] **Step 5: Run focused Rails and browser tests**

Run the same commands as Step 3.
Expected: PASS for add, server confirmation, reload persistence, remove, and no-JavaScript fallback.

---

### Task 4: Enable scoped styles for the article list

**Files:**
- Modify: `experiments/herb/Gemfile`
- Modify: `experiments/herb/Gemfile.lock`
- Modify: `experiments/herb/config/initializers/reactionview.rb`
- Modify: `experiments/herb/app/views/articles/_article_list.html.erb`
- Modify: `experiments/herb/test/integration/content_test.rb`

**Interfaces:**
- Consumes: pinned Herb `ScopedStyle::Visitor` and Lightning CSS integration documented by Herb.
- Produces: article-list CSS scoped to markup emitted by `_article_list.html.erb`.

- [x] **Step 1: Add a failing assertion for scoped style output**

Request the article page and assert the article-list stylesheet is transformed into scoped selectors and article markup carries the corresponding scope marker.

- [x] **Step 2: Run the focused Rails test**

Run: `cd experiments/herb && bin/rails test test/integration/content_test.rb`
Expected: FAIL because no scoped-style visitor is registered.

- [x] **Step 3: Add Lightning CSS and register the visitor**

Follow the pinned Herb visitor API and configuration documented in the upstream Scoped Styles guide. Put only article-list styles in the partial; retain global design tokens and unrelated page styles in the existing global stylesheet.

- [x] **Step 4: Run focused Rails tests and inspect generated CSS**

Run: `cd experiments/herb && bin/rails test test/integration/content_test.rb`
Expected: PASS with scoped CSS output and unchanged route/content assertions.

---

### Task 5: Full local verification and documentation

**Files:**
- Modify: `experiments/herb/README.md`
- Verify: `experiments/herb/` and root Herb test scripts

**Interfaces:**
- Consumes: completed session, Outbox, and scoped-style behavior.
- Produces: documented local behavior and a verified, deploy-free branch.

- [x] **Step 1: Document the saved-list session behavior and local test commands**

Explain browser-local persistence, the item cap, no-JavaScript behavior, and Outbox failure retry/discard controls.

- [x] **Step 2: Run the full Herb verification suite**

Run: `bun run verify:herb`
Expected: PASS with no new failures; report existing textlint warnings separately if they remain.

- [x] **Step 3: Run Herb browser E2E**

Run: `bun run test:e2e:herb`
Expected: PASS including read-later add, remove, reload persistence, and existing blog flows.

- [x] **Step 4: Review the final diff**

Run: `git diff --check` and `git status --short`.
Expected: only the Herb experiment and its implementation documents changed; no deployment or push occurred.

- [x] **Step 5: Verify sequential Outbox confirmations preserve earlier saved rows**

Add two articles through separate successful Outbox requests, assert both rows remain before and after reload, and run the full E2E suite. The pinned client merges incoming items by key, so the confirmation containing the newly added row preserves earlier rows.
