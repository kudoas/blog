import { Runtime } from "reactionview"

const explorer = document.querySelector(".article-explorer")

if (explorer) {
  const articles = JSON.parse(explorer.dataset.articles)
  const byUrl = new Map(articles.map((article) => [article.url, article]))
  const input = explorer.querySelector("#article-search")
  const tagFilter = explorer.querySelector("#tag-filter")
  const form = explorer.querySelector("form[role=search]")
  const clearButton = explorer.querySelector(".clear-search")
  let pagefindPromise
  let searchQueue = Promise.resolve()
  let composing = false
  let generation = 0
  let confirmed = { q: input.value, tag: tagFilter.value }

  function pagefind() {
    pagefindPromise ??= import("/pagefind/pagefind.js").catch((error) => {
      pagefindPromise = undefined
      throw error
    })
    return pagefindPromise
  }

  function find(query, tag) {
    const task = searchQueue.then(async () => {
      const index = await pagefind()
      const result = await index.search(query.normalize("NFKC").toLocaleLowerCase("ja").trim(), {
        filters: tag ? { tag } : {},
      })
      const data = await Promise.all(result.results.map((item) => item.data()))
      return data.flatMap(({ url, excerpt }) => {
        const article = byUrl.get(url)
        return article ? [{ id: article.id, excerpt }] : []
      })
    })
    searchQueue = task.catch(() => undefined)
    return task
  }

  const runtime = Runtime.start({
    state: {
      debounce: 300,
      transport: async (request, signal) => {
        const q = request.state.q ?? input.value
        const tag = request.state.tag ?? tagFilter.value
        let hits = []
        let fallback = !q.trim()
        if (!fallback) {
          try {
            hits = await find(q, tag)
          } catch {
            fallback = true
            runtime.state.setState({ search_error: true })
          }
        }
        if (signal.aborted) throw new DOMException("Search superseded", "AbortError")

        const response = await fetch("/search?format=slots", {
          method: "POST",
          signal,
          headers: {
            Accept: "application/vnd.herb.slots+json",
            "Content-Type": "application/json",
            "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content,
          },
          body: JSON.stringify({
            q, tag, fallback,
            ids: hits.map((hit) => hit.id),
            excerpts: Object.fromEntries(hits.map((hit) => [hit.id, hit.excerpt])),
          }),
        })
        if (!response.ok) throw new Error(`Herb search failed: ${response.status}`)
        return response.json()
      },
    },
  })

  runtime.behaviors.define("data-search-excerpt", {
    connect: renderExcerpt,
    updated: renderExcerpt,
  })

  function renderExcerpt(element) {
    const fragment = document.createDocumentFragment()
    const copy = (source, destination) => {
      if (source.nodeType === Node.TEXT_NODE) {
        destination.append(document.createTextNode(source.nodeValue ?? ""))
      } else if (source.nodeType === Node.ELEMENT_NODE && source.nodeName === "MARK") {
        const mark = document.createElement("mark")
        for (const child of source.childNodes) copy(child, mark)
        destination.append(mark)
      } else if (source.nodeType === Node.ELEMENT_NODE) {
        destination.append(document.createTextNode(source.outerHTML))
      } else {
        for (const child of source.childNodes) copy(child, destination)
      }
    }
    for (const child of [...element.childNodes]) copy(child, fragment)
    element.replaceChildren(fragment)
  }

  function urlFor(next) {
    const url = new URL(window.location.href)
    for (const [key, value] of Object.entries(next)) {
      if (value) url.searchParams.set(key, value)
      else url.searchParams.delete(key)
    }
    return `${url.pathname}${url.search}${url.hash}`
  }

  async function update(next, { history = true } = {}) {
    const current = ++generation
    if (history) window.history.replaceState(null, "", urlFor(next))
    clearButton.hidden = !next.q && !next.tag
    runtime.state.setState({ pending: Boolean(next.q.trim()), search_error: false })
    const report = await runtime.state.set(next)
    if (current !== generation) return
    runtime.state.setState({ pending: false })
    if (report.failed || report.restored) {
      input.value = confirmed.q
      tagFilter.value = confirmed.tag
      window.history.replaceState(null, "", urlFor(confirmed))
      runtime.state.setState({ search_error: true })
    } else {
      confirmed = next
    }
  }

  form.addEventListener("submit", (event) => event.preventDefault())
  input.addEventListener("compositionstart", () => { composing = true })
  input.addEventListener("compositionend", () => {
    composing = false
    update({ q: input.value, tag: tagFilter.value })
  })
  input.addEventListener("input", () => {
    if (!composing) update({ q: input.value, tag: tagFilter.value })
  })
  tagFilter.addEventListener("change", () => update({ q: input.value, tag: tagFilter.value }))
  explorer.addEventListener("click", (event) => {
    if (!event.target.closest(".clear-search")) return
    input.value = ""
    tagFilter.value = ""
    update({ q: "", tag: "" })
  })
  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(location.search)
    input.value = params.get("q") ?? ""
    tagFilter.value = params.get("tag") ?? ""
    update({ q: input.value, tag: tagFilter.value }, { history: false })
  })

  if (input.value || tagFilter.value) update(confirmed, { history: false })
}
