export async function proxyBlogRequest(
  request: Request,
  getContainer: () => Promise<Response>,
): Promise<Response> {
  try {
    const upstream = await getContainer()
    const headers = new Headers(upstream.headers)
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    const isDynamic = request.method !== "GET" || request.headers.get("Accept")?.includes("text/html") ||
      new URL(request.url).searchParams.has("format")
    if (isDynamic) headers.set("Cache-Control", "no-store")
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
  } catch (error) {
    console.error("Herb blog container request failed", error)
    return new Response("Blog container is starting or unavailable. Please retry shortly.\n", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "5",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    })
  }
}
