import { createRouter } from "remix/router";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { createElement as h } from "remix/component";
import { renderToString } from "remix/component/server";
import { Gallery } from "../dist/remix3.js";
const titles = [
  "Alpine stillness",
  "Quiet architecture",
  "The long way home",
  "A softer morning",
  "Lines & light",
  "Beyond the shore",
  "Wild and unhurried",
  "Where we wander",
  "Concrete poetry",
  "Last light",
  "Open horizons",
  "A place to pause",
];
export const images = titles.map((title, i) => ({
  id: String(i + 1),
  title,
  alt: `${title}: an illustrated landscape study`,
  category: ["Landscape", "Architecture", "Travel"][i % 3],
  width: i % 3 === 1 ? 1000 : 1500,
  height: i % 3 === 1 ? 1300 : 1000,
  src: `/media/${i + 1}.svg`,
  color: ["#bed0cd", "#d1c5b6", "#b4bec2"][i % 3],
}));
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function page(path) {
  const image = path.match(/^\/image\/(\d+)$/)?.[1];
  const category = path.match(/^\/category\/(\w+)$/)?.[1];
  const list = category
    ? images.filter((i) => i.category.toLowerCase() === category)
    : images;
  const chosen = images.find((i) => i.id === image);
  if ((image && !chosen) || (category && !list.length)) return null;
  const grid = await renderToString(h(Gallery, { items: list }));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fieldnotes — A collection of perspectives</title><link rel="stylesheet" href="/style.css"></head><body><header><a class="brand" href="/">fieldnotes<span>®</span></a><nav aria-label="Main"><a href="/" aria-current="page">Collection</a><a href="#about">About the project ↗</a></nav><span class="edition">VOL. 001 / 2026</span></header><main><section class="intro"><div class="eyebrow"><span class="dot"></span> AN INDEPENDENT VISUAL JOURNAL</div><h1>A collection of<br><em>perspectives.</em></h1><div class="intro-bottom"><p>Finding the extraordinary in the everyday.<br>A curated archive of places, spaces, and quiet moments.</p><span>SCROLL TO EXPLORE ↓</span></div></section>${chosen ? `<article class="detail"><a href="/">← Back to collection</a><h2>${escape(chosen.title)}</h2><img src="${chosen.src}" alt="${escape(chosen.alt)}"><p>${escape(chosen.category)}</p></article>` : ""}<section class="collection" aria-label="Image collection"><div class="tools"><nav aria-label="Categories"><a class="chip ${!category ? "active" : ""}" href="/" data-filter="All">All works <sup>12</sup></a>${["Landscape", "Architecture", "Travel"].map((c) => `<a class="chip ${category === c.toLowerCase() ? "active" : ""}" href="/category/${c.toLowerCase()}" data-filter="${c}">${c}</a>`).join("")}</nav><div class="layout-tools"><select aria-label="Sort images" id="sort"><option value="original">Curated order</option><option value="title">Title A–Z</option><option value="reverse">Reverse order</option></select><span id="count">${list.length} perspectives</span><button aria-label="Masonry layout" data-layout="masonry" aria-pressed="true">▥</button><button aria-label="Grid layout" data-layout="grid" aria-pressed="false">▦</button></div></div><div id="gallery-island">${grid}</div><div class="collection-end"><span>YOU'VE SEEN THE COLLECTION</span><div class="experiment-buttons"><button id="deep">Explore the deep atlas ↗</button><button id="extensions">Compare & annotate ↗</button><button id="large">Explore 10,000 studies ↗</button></div></div><div id="large-gallery" tabindex="0" aria-label="Large virtualized collection" hidden></div></section><section id="deep-demo" hidden aria-label="Deep image atlas"></section><section id="extension-demo" hidden aria-label="Comparison experiment"></section><section id="about"><span>EVERY FRAME, A DIFFERENT PERSPECTIVE.</span><p>An open-source gallery experiment.<br>Illustrated studies, made for a slower look.</p></section></main><footer><a class="brand" href="/">fieldnotes<span>®</span></a><span>DESIGNED TO BE EXPLORED. © 2026</span><a href="#">BACK TO TOP ↑</a></footer><script id="all-gallery-data" type="application/json">${JSON.stringify(images).replace(/</g, "\\u003c")}</script><script id="gallery-data" type="application/json">${JSON.stringify(list).replace(/</g, "\\u003c")}</script><script type="module" src="/client.js"></script></body></html>`;
}
function art(n) {
  const palettes = [
    ["#b7c8c5", "#637f79", "#314f4b"],
    ["#d8ccb9", "#ad9b80", "#706f60"],
    ["#c0ced4", "#839da7", "#3b646e"],
    ["#ddd0b5", "#a5ad8a", "#687e66"],
  ];
  const [sky, mid, front] = palettes[n % 4];
  const arch = n % 3 === 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="${n % 3 === 2 ? 1950 : 1000}" viewBox="0 0 1500 1000" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="#ede6d7"/></linearGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".12"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs><g filter="url(#grain)"><path fill="url(#s)" d="M0 0h1500v1000H0z"/><circle cx="${1000 - n * 25}" cy="220" r="100" fill="#f5eedb" opacity=".8"/>${arch ? `<path fill="${mid}" d="M300 100h900v900H300z"/><path fill="${front}" d="M500 1000V520a250 250 0 0 1 500 0v480z"/><path fill="${sky}" d="M590 1000V520a160 160 0 0 1 320 0v480z"/><path fill="#ede5d4" d="M0 900h1500v100H0z"/>` : `<path fill="${mid}" d="M0 650L350 ${180 + n * 14} 650 580 1050 260 1500 600v400H0z"/><path fill="#e6e4d6" opacity=".65" d="m350 ${180 + n * 14} 135 180-100-40-70 80-50-90z"/><path fill="${front}" d="M0 900q250-420 600-160t900-150v410H0z"/><path fill="${sky}" opacity=".55" d="M900 700q-500 180-100 300h300q-500-100-200-300z"/>`}</g></svg>`;
}
export const router = createRouter();
async function renderPage({ request }) {
  const body = await page(new URL(request.url).pathname);
  return new Response(body ?? "Not found", {
    status: body ? 200 : 404,
    headers: {
      "Content-Type": body ? "text/html; charset=utf-8" : "text/plain",
    },
  });
}
router.get("/", renderPage);
router.get("/image/:id", renderPage);
router.get("/category/:category", renderPage);
router.get("/media/:file.svg", ({ params }) => {
  const match = params.file.match(/^(\d+)$/);
  const n = Number(match?.[1]);
  return n >= 1 && n <= images.length
    ? new Response(art(n), {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=3600",
        },
      })
    : new Response("Not found", { status: 404 });
});
for (const file of ["client.js", "style.css"])
  router.get(
    "/" + file,
    async () =>
      new Response(await readFile("public/" + file), {
        headers: {
          "Content-Type": file.endsWith(".js") ? "text/javascript" : "text/css",
        },
      }),
  );
router.get("/chunks/:file.js", async ({ params }) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(params.file))
    return new Response("Not found", { status: 404 });
  try {
    return new Response(await readFile(`public/chunks/${params.file}.js`), {
      headers: { "Content-Type": "text/javascript" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
});
export function serve(port = 4173) {
  return http
    .createServer(async (req, res) => {
      const abort = new AbortController();
      req.on("aborted", () => abort.abort());
      try {
        const response = await router.fetch(
          new Request(new URL(req.url, "http://localhost"), {
            method: req.method,
            signal: abort.signal,
          }),
        );
        if (abort.signal.aborted) return;
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        if (!res.headersSent) res.writeHead(500);
        res.end("Unable to render gallery");
      }
    })
    .listen(port, "127.0.0.1");
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env.PORT ?? 4173);
  serve(port);
  console.log(`Fieldnotes: http://127.0.0.1:${port}`);
}
