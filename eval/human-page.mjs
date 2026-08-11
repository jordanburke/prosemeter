/**
 * Render the run-7 phase 1c reading pack as a standalone page.
 *
 * The pack is ~14,000 words of careful comparison reading. In an editor that is a slog, and a slog
 * degrades the judgment being measured — a tired reader falls back on surface cues, which is the
 * failure mode this whole phase exists to detect.
 *
 * Generated from `human/run-7-key.json` and the corpus rather than hand-written, so the page and the
 * key cannot drift, and the page can be regenerated if the sample changes.
 *
 * ## Two design decisions that come from the experiment, not from taste
 *
 * **Answers are stacked, never side by side.** The model raters read them stacked in a text file,
 * and presentation geometry is exactly the variable phase 1 caught moving verdicts by 30–50 points.
 * A side-by-side layout would read better and would make the human's task a different task.
 *
 * **A and B are visually identical.** Same panel, same type, same weight, distinguished only by a
 * neutral mono letter. Any asymmetry — a tint, a border, an order cue — is a thumb on the scale in a
 * measurement whose entire point is that thumbs on scales are easy to miss.
 *
 * Usage: node eval/human-page.mjs
 */

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const KEY = JSON.parse(readFileSync(`${HERE}human/run-7-key.json`, "utf8"))
const CORPUS = `${HERE}corpus/run-6`

const TASKS = Object.fromEntries(
  readFileSync(`${HERE}tasks.md`, "utf8")
    .split("\n")
    .map((l) => /^(T\d+): (.+)$/.exec(l.trim()))
    .filter((m) => m !== null)
    .map((m) => [m[1], m[2]]),
)

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/**
 * Inline spans: code is lifted out first, so emphasis markers inside a code span are left alone.
 *
 * The placeholder uses private-use codepoints rather than a bare " 0 "-style number. Digits
 * collide: a paragraph reading "on 3 of the props" matches a bare-number placeholder and indexes
 * into the code array, giving `undefined` or a crash. The first version of this did exactly that
 * and survived only because none of these 20 answers happened to hit it — luck, not design, and it
 * would have fired the next time the sample changed.
 */
const OPEN = "\uE000"
const CLOSE = "\uE001"

const inline = (s) => {
  const codes = []
  const held = s.replace(/`([^`]+)`/g, (_, c) => OPEN + (codes.push(c) - 1) + CLOSE)
  return esc(held)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:)]|$)/g, "$1<em>$2</em>")
    .replace(new RegExp(OPEN + "(\\d+)" + CLOSE, "g"), (_, i) => "<code>" + esc(codes[Number(i)]) + "</code>")
}

/**
 * Just enough markdown for this corpus: h2, fenced code, ordered and unordered lists, paragraphs.
 * A sweep of all 60 answers found no other block construct — no tables, no h3, no blockquotes — so
 * a general renderer would be dead code with more ways to be wrong.
 */
const render = (md) => {
  const out = []
  const lines = md.split("\n")
  let i = 0
  let list = null

  const closeList = () => {
    if (list !== null) {
      out.push(`</${list}>`)
      list = null
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith("```")) {
      closeList()
      const buf = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++])
      i++
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`)
      continue
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h !== null) {
      closeList()
      const level = Math.min(h[1].length + 2, 6)
      out.push(`<h${level}>${inline(h[2])}</h${level}>`)
      i++
      continue
    }
    const ul = /^[-*]\s+(.*)$/.exec(line)
    if (ul !== null) {
      if (list !== "ul") {
        closeList()
        out.push("<ul>")
        list = "ul"
      }
      out.push(`<li>${inline(ul[1])}</li>`)
      i++
      continue
    }
    const ol = /^\d+\.\s+(.*)$/.exec(line)
    if (ol !== null) {
      if (list !== "ol") {
        closeList()
        out.push("<ol>")
        list = "ol"
      }
      out.push(`<li>${inline(ol[1])}</li>`)
      i++
      continue
    }
    if (line.trim() === "") {
      closeList()
      i++
      continue
    }
    closeList()
    const buf = [line]
    i++
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4}\s|[-*]\s|\d+\.\s|```)/.test(lines[i])) buf.push(lines[i++])
    out.push(`<p>${inline(buf.join(" "))}</p>`)
  }
  closeList()
  return out.join("\n")
}

const body = (f) => readFileSync(`${CORPUS}/${f}`, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "").trim()

const pairs = KEY.key
  .map((k) => {
    // The key stores which arm sits in each slot. The page must never say so — it renders the two
    // answers under neutral letters and nothing else.
    const A = body(`${k.A}-${k.pair}.md`)
    const B = body(`${k.B}-${k.pair}.md`)
    return `
<section class="pair" id="pair-${k.n}" data-n="${k.n}">
  <header class="pair-head">
    <span class="tag">Pair ${k.n} of ${KEY.key.length}</span>
    <blockquote class="ask">${esc(TASKS[k.task])}</blockquote>
  </header>
  <article class="answer"><div class="slot">A</div><div class="prose">${render(A)}</div></article>
  <article class="answer"><div class="slot">B</div><div class="prose">${render(B)}</div></article>
  <fieldset class="verdict" data-pair="${k.n}">
    <legend>Which better serves the person who asked?</legend>
    <div class="opts">
      <button type="button" data-v="A">Answer A</button>
      <button type="button" data-v="tie">Tie</button>
      <button type="button" data-v="B">Answer B</button>
    </div>
    <label class="why"><span>Why, in one sentence</span><textarea rows="2" data-why="${k.n}"></textarea></label>
  </fieldset>
</section>`
  })
  .join("\n")

const html = `<title>Ten pairs, blind — reading pack</title>
<style>
  /* Drop-out blue: the ink used on scan forms precisely because it is meant to be read blind.
     Neutrals carry a slight blue bias so they read as chosen rather than as default grey. */
  :root {
    --paper: #f7f8fa;
    --panel: #ffffff;
    --ink: #1a1e23;
    --muted: #6c7681;
    --rule: #dce0e5;
    --accent: #2f6f91;
    --accent-soft: #e2edf3;
    --shadow: 0 1px 2px rgb(26 30 35 / 0.05);
    --serif: "Iowan Old Style", "Charter", "Bitstream Charter", Georgia, "Times New Roman", serif;
    --sans: ui-sans-serif, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper: #12151a;
      --panel: #191d23;
      --ink: #e4e8ec;
      --muted: #8b949e;
      --rule: #262c33;
      --accent: #6faecb;
      --accent-soft: #1d2b34;
      --shadow: none;
    }
  }
  :root[data-theme="dark"] {
    --paper: #12151a;
    --panel: #191d23;
    --ink: #e4e8ec;
    --muted: #8b949e;
    --rule: #262c33;
    --accent: #6faecb;
    --accent-soft: #1d2b34;
    --shadow: none;
  }

  * { box-sizing: border-box; }
  body {
    background: var(--paper);
    color: var(--ink);
    font-family: var(--serif);
    font-size: 1.0625rem;
    line-height: 1.65;
    margin: 0;
    padding: 0 1.25rem 6rem;
  }
  .wrap { max-width: 42rem; margin: 0 auto; }

  /* Chrome ------------------------------------------------------------------ */
  .bar {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
    padding: 0.7rem 1.25rem;
    margin: 0 -1.25rem 2.5rem;
    background: color-mix(in srgb, var(--paper) 92%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--rule);
    font-family: var(--sans); font-size: 0.8125rem;
  }
  .bar .inner { max-width: 42rem; margin: 0 auto; width: 100%; display: flex; align-items: center; gap: 1rem; }
  .count { font-family: var(--mono); font-variant-numeric: tabular-nums; color: var(--muted); }
  .track { flex: 1; height: 3px; background: var(--rule); border-radius: 2px; overflow: hidden; min-width: 4rem; }
  .track span { display: block; height: 100%; width: 0; background: var(--accent); transition: width 0.25s ease; }
  @media (prefers-reduced-motion: reduce) { .track span { transition: none; } }

  h1 { font-size: 1.75rem; line-height: 1.2; text-wrap: balance; margin: 0 0 0.75rem; }
  .lede { color: var(--muted); margin: 0 0 1.25rem; }
  .brief { border-left: 2px solid var(--accent); padding: 0.1rem 0 0.1rem 1rem; margin: 0 0 3rem; }
  .brief p { margin: 0.5rem 0; }

  /* A pair ------------------------------------------------------------------ */
  .pair { border-top: 1px solid var(--rule); padding-top: 2rem; margin-top: 3.5rem; }
  .pair-head { margin-bottom: 1.5rem; }
  .tag {
    font-family: var(--mono); font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--muted);
  }
  .ask {
    margin: 0.6rem 0 0; padding: 0 0 0 1rem;
    border-left: 2px solid var(--rule);
    font-family: var(--sans); font-size: 0.9375rem; color: var(--ink);
  }

  /* A and B are deliberately identical. Only the letter differs. */
  .answer {
    background: var(--panel);
    border: 1px solid var(--rule);
    border-radius: 3px;
    box-shadow: var(--shadow);
    padding: 1.5rem 1.75rem;
    margin-bottom: 1.25rem;
  }
  .slot {
    font-family: var(--mono); font-size: 0.75rem; font-weight: 600;
    letter-spacing: 0.1em; color: var(--accent);
    padding-bottom: 0.75rem; margin-bottom: 1rem;
    border-bottom: 1px solid var(--rule);
  }
  .prose > :first-child { margin-top: 0; }
  .prose > :last-child { margin-bottom: 0; }
  .prose h4 { font-family: var(--sans); font-size: 0.9375rem; margin: 1.75rem 0 0.5rem; }
  .prose p, .prose li { margin: 0.75rem 0; }
  .prose ul, .prose ol { padding-left: 1.25rem; }
  .prose code { font-family: var(--mono); font-size: 0.85em; background: var(--accent-soft); padding: 0.1em 0.3em; border-radius: 2px; }
  .prose pre {
    background: var(--accent-soft); border-radius: 3px; padding: 0.9rem 1rem;
    overflow-x: auto; font-size: 0.8125rem; line-height: 1.5;
  }
  .prose pre code { background: none; padding: 0; font-size: inherit; }

  /* Verdict ----------------------------------------------------------------- */
  .verdict { border: none; padding: 0; margin: 1.5rem 0 0; font-family: var(--sans); }
  .verdict legend { font-size: 0.8125rem; color: var(--muted); padding: 0; margin-bottom: 0.6rem; }
  .opts { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .opts button {
    font: inherit; font-size: 0.875rem;
    padding: 0.5rem 1rem; cursor: pointer;
    background: var(--panel); color: var(--ink);
    border: 1px solid var(--rule); border-radius: 3px;
  }
  .opts button:hover { border-color: var(--accent); }
  .opts button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .opts button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--paper); }
  .why { display: block; margin-top: 0.75rem; }
  .why span { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: 0.3rem; }
  .why textarea {
    font: inherit; font-size: 0.875rem; width: 100%; resize: vertical;
    padding: 0.5rem 0.6rem; color: var(--ink); background: var(--panel);
    border: 1px solid var(--rule); border-radius: 3px;
  }
  .why textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  /* Record ------------------------------------------------------------------ */
  .record { border-top: 1px solid var(--rule); margin-top: 3.5rem; padding-top: 2rem; }
  .record h2 { font-size: 1.25rem; margin: 0 0 0.5rem; }
  .record p { color: var(--muted); font-family: var(--sans); font-size: 0.875rem; margin: 0 0 1rem; }
  #out {
    font-family: var(--mono); font-size: 0.8125rem; line-height: 1.7;
    white-space: pre; overflow-x: auto;
    background: var(--panel); border: 1px solid var(--rule); border-radius: 3px;
    padding: 1rem 1.1rem; margin: 0 0 1rem;
  }
  .copy {
    font-family: var(--sans); font-size: 0.875rem; padding: 0.5rem 1.1rem; cursor: pointer;
    background: var(--accent); color: var(--paper); border: 1px solid var(--accent); border-radius: 3px;
  }
  .copy:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
</style>

<div class="bar">
  <div class="inner">
    <span class="count"><b id="done">0</b>/${KEY.key.length} judged</span>
    <span class="track"><span id="fill"></span></span>
    <a href="#record" style="color: var(--accent);">Record</a>
  </div>
</div>

<div class="wrap">
  <h1>Ten pairs, blind</h1>
  <p class="lede">Two answers to each question, by different writers. Pick the one that better serves the person who asked.</p>

  <div class="brief">
    <p><strong>Better</strong> means the reader understands the answer and can act on it. Don't reward length in either direction — a longer answer isn't more thorough, and a shorter one isn't clearer.</p>
    <p>Tie is a real answer. If two are genuinely equivalent, say so rather than picking one.</p>
    <p>About 14,000 words in total. The pairs are independent, so stopping partway is fine — whatever you judge can be analysed. Your answers are kept in this browser as you go.</p>
  </div>
</div>

<div class="wrap">
${pairs}

  <section class="record" id="record">
    <h2>Your record</h2>
    <p>Paste this back when you're done, or partway.</p>
    <div id="out">nothing judged yet</div>
    <button class="copy" type="button" id="copy">Copy record</button>
  </section>
</div>

<script>
  const N = ${KEY.key.length}
  const STORE = "prosemeter-run7-1c"
  const state = (() => {
    try { return JSON.parse(localStorage.getItem(STORE)) || {} } catch { return {} }
  })()

  const save = () => {
    try { localStorage.setItem(STORE, JSON.stringify(state)) } catch { /* private mode — the page still works */ }
  }

  const out = document.getElementById("out")
  const draw = () => {
    const lines = []
    for (let n = 1; n <= N; n++) {
      const s = state[n]
      if (s && s.v) lines.push("pair " + n + ": better=" + s.v + " | why=" + (s.why || "").replace(/\\s+/g, " ").trim())
    }
    out.textContent = lines.length ? lines.join("\\n") : "nothing judged yet"
    document.getElementById("done").textContent = String(lines.length)
    document.getElementById("fill").style.width = (100 * lines.length / N) + "%"
  }

  document.querySelectorAll(".verdict").forEach((fs) => {
    const n = fs.dataset.pair
    fs.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(state[n] && state[n].v === b.dataset.v))
      b.addEventListener("click", () => {
        state[n] = Object.assign({}, state[n], { v: b.dataset.v })
        fs.querySelectorAll("button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)))
        save(); draw()
      })
    })
    const ta = fs.querySelector("textarea")
    ta.value = (state[n] && state[n].why) || ""
    ta.addEventListener("input", () => {
      state[n] = Object.assign({}, state[n], { why: ta.value })
      save(); draw()
    })
  })

  document.getElementById("copy").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(out.textContent)
      e.target.textContent = "Copied"
      setTimeout(() => { e.target.textContent = "Copy record" }, 1500)
    } catch {
      e.target.textContent = "Select the text above to copy"
    }
  })

  draw()
</script>
`

writeFileSync(`${HERE}human/reading-pack.html`, html)
console.log(`eval/human/reading-pack.html  —  ${KEY.key.length} pairs, ${(html.length / 1024).toFixed(0)} KB`)
