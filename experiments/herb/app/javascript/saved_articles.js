import { Runtime } from "reactionview"

const runtime = Runtime.start()
runtime.outbox.unobserve()

async function refreshAfterSave(result) {
  if (result.status !== "confirmed") return
  const report = await runtime.state.refresh()
  if (report.failed) window.location.reload()
}

document.addEventListener("submit", (event) => {
  if (!(event.target instanceof HTMLFormElement) || !event.target.matches("[data-herb-into]")) return
  event.preventDefault()
  const result = runtime.outbox.submitForm(event.target)
  if (result) void result.then(refreshAfterSave)
})

document.addEventListener("submit", async (event) => {
  if (!(event.target instanceof HTMLFormElement) || !event.target.matches("[data-herb-remove]")) return

  const runtime = Runtime.get()
  if (!runtime) return

  const form = event.target
  const button = form.querySelector('button[type="submit"]')
  const articleId = form.querySelector('input[name="article_id"]')?.value
  if (!form.action || !articleId || button?.disabled) return

  event.preventDefault()
  button.disabled = true
  const url = new URL(form.action)
  url.searchParams.set("format", "slots")

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.herb.slots+json",
        "Content-Type": "application/json",
        "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content,
      },
      body: JSON.stringify({ article_id: articleId }),
    })
    if (!response.ok) throw new Error(`Herb removal failed: ${response.status}`)
    const report = runtime.slots.apply(await response.json())
    if (report.applied === 0) throw new Error("Herb removal slots could not be applied")
  } catch (error) {
    button.disabled = false
    let alert = form.querySelector("[role=alert]")
    if (!alert) {
      alert = document.createElement("p")
      alert.setAttribute("role", "alert")
      form.append(alert)
    }
    alert.textContent = "解除に失敗しました。もう一度お試しください。"
    console.error(error)
  }
})

document.addEventListener("click", async (event) => {
  if (!(event.target instanceof Element)) return
  const button = event.target.closest("[data-outbox-retry], [data-outbox-discard]")
  const runtime = Runtime.get()
  if (!button || !runtime) return
  event.preventDefault()
  if (button.hasAttribute("data-outbox-retry")) {
    const result = runtime.outbox.retry(button)
    if (result) await refreshAfterSave(await result)
  } else {
    runtime.outbox.discard(button)
  }
})
