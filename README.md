# piconic koma

**piconic koma** stitches your frame-by-frame code into a single video.

"koma" is Japanese for "frame."

Built with [Hono](https://hono.dev) and [Barefoot.js](https://barefootjs.dev/).

## Setup

```sh
bun install   # install dependencies
bun run dev   # start the dev server at http://localhost:8787
```

Other scripts:

- `bun run build` — production build
- `bun test` — run the test suite
- `bun run deploy` — build and deploy to Cloudflare Workers

Production (`koma.piconic.ai`) deploys when a tagpr release PR is merged
(see `.github/workflows/tagpr.yml`). Every other branch gets its own
[Worker Preview](https://developers.cloudflare.com/workers/previews/) on
push, at `https://<branch-name>-koma.<subdomain>.workers.dev`, with its own
logs under the Preview's Observability tab (Cloudflare dashboard → koma
Worker → Previews). Previews are configured by the `previews` block in
`wrangler.jsonc`.

## Contact

Questions or feedback? Reach out to kobaken:

- [x.com/kfly8](https://x.com/kfly8)
- kentafly88@gmail.com
