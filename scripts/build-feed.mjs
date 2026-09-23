import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "BeatWindowsFeedBot/1.0 (+https://beatwindows.org)";
const PER_SOURCE = 12;
const PER_TAG = 20;
const MAX_AGE_DAYS = 30;
const MAX_ITEMS = 80;

const decode = s => String(s)
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]+>/g, "")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&apos;|&#39;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

function tag(block, name){
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
}
function atomLink(block){
  const m = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i);
  return m ? m[1] : "";
}
function parseFeed(xml, src){
  const chunks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  const cap = src.limit || PER_SOURCE;
  const items = [];
  for (const c of chunks){
    let title = decode(tag(c, "title"));
    const pub = decode(tag(c, "source"));
    const source = pub || src.name;
    if (pub && title.endsWith(" - " + pub)) title = title.slice(0, title.length - pub.length - 3);
    let url = (tag(c, "link") + "").trim() || atomLink(c);
    url = decode(url);
    if (url && !/^https?:/i.test(url)){
      try { url = new URL(url, src.site || src.url).href; } catch { url = ""; }
    }
    const dateRaw = tag(c, "pubDate") || tag(c, "published") || tag(c, "updated") || tag(c, "dc:date");
    const date = new Date(decode(dateRaw));
    if (title && /^https?:/i.test(url)) items.push({
      title, url, source, tag: src.tag, site: src.site || "",
      date: isNaN(date) ? "" : date.toISOString()
    });
    if (items.length >= cap) break;
  }
  return items;
}
async function fetchText(url){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
      redirect: "follow", signal: ctrl.signal
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rfc822 = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toUTCString(); };

function buildXml(items, generated){
  const entries = items.map(it => `    <item>
      <title>${esc(it.title)}</title>
      <link>${esc(it.url)}</link>
      <guid isPermaLink="true">${esc(it.url)}</guid>
      <category>${esc(it.tag)}</category>
      <source url="${esc(it.site || "https://beatwindows.org/")}">${esc(it.source)}</source>
${it.date ? `      <pubDate>${rfc822(it.date)}</pubDate>\n` : ""}    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Beat Windows · Unix news</title>
    <link>https://beatwindows.org/</link>
    <description>Latest from Linux, the BSDs and macOS — the OSes that never blue-screen.</description>
    <language>en</language>
    <lastBuildDate>${rfc822(generated)}</lastBuildDate>
    <atom:link href="https://beatwindows.org/feed.xml" rel="self" type="application/rss+xml"/>
${entries}
  </channel>
</rss>
`;
}

const cfg = JSON.parse(await readFile(join(root, "data/sources.json"), "utf8"));
const fresh = [];
for (const src of cfg.sources){
  try {
    const xml = await fetchText(src.url);
    const items = parseFeed(xml, src);
    console.log(`${src.name}: ${items.length} items`);
    fresh.push(...items);
  } catch (e){
    console.warn(`${src.name}: failed (${e.message})`);
  }
}

let previous = [];
try {
  previous = (JSON.parse(await readFile(join(root, "data/feed.json"), "utf8")).items) || [];
} catch {}

const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
const seen = new Set();
const merged = [];
for (const it of [...fresh, ...previous]){
  if (!it || !it.url || !it.title) continue;
  const key = it.url.replace(/[#?].*$/, "").replace(/\/$/, "");
  if (seen.has(key)) continue;
  seen.add(key);
  if (it.date && Date.parse(it.date) < cutoff) continue;
  merged.push({ title: it.title, url: it.url, source: it.source || "", tag: it.tag || "linux", site: it.site || "", date: it.date || "" });
}
merged.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));

const generated = new Date().toISOString();
const byTag = {};
const items = [];
for (const it of merged){
  const t = it.tag || "other";
  byTag[t] = byTag[t] || 0;
  if (byTag[t] >= PER_TAG) continue;
  byTag[t]++;
  items.push(it);
  if (items.length >= MAX_ITEMS) break;
}
await mkdir(join(root, "data"), { recursive: true });
await writeFile(join(root, "data/feed.json"), JSON.stringify({ generated, items }, null, 2) + "\n");
await writeFile(join(root, "feed.xml"), buildXml(items.slice(0, 50), generated));
console.log(`feed: ${items.length} items written`);
