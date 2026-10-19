import { Container } from "@cloudflare/containers"
import { proxyBlogRequest } from "./proxy"

interface Env {
  BLOG_CONTAINER: DurableObjectNamespace<BlogContainer>
  SECRET_KEY_BASE: string
}

export class BlogContainer extends Container<Env> {
  defaultPort = 3000
  sleepAfter = "5m"

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.envVars = {
      RAILS_ENV: "production",
      SECRET_KEY_BASE: env.SECRET_KEY_BASE,
      RAILS_LOG_TO_STDOUT: "1",
    }
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const forwarded = new Request(request, {
      headers: new Headers(request.headers),
    })
    forwarded.headers.set("X-Forwarded-Proto", "https")
    forwarded.headers.set("X-Forwarded-Host", new URL(request.url).host)
    return proxyBlogRequest(forwarded, () => env.BLOG_CONTAINER.getByName("blog").fetch(forwarded))
  },
}
