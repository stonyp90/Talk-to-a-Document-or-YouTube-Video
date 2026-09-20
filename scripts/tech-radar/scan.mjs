import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(here, "config.json"), "utf8"));

const KEYWORDS_LOWER = config.keywords.map((k) => k.toLowerCase());
const MAX_RESULTS = config.maxResultsPerSource;
const LOOKBACK_DAYS = config.lookbackDays;
const REQUEST_TIMEOUT_MS = 15_000;
const BETWEEN_REQUEST_DELAY_MS = 1_500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function matchesKeywords(text) {
  const lower = (text || "").toLowerCase();
  return KEYWORDS_LOWER.some((kw) => lower.includes(kw));
}

function relevanceTags(text) {
  const lower = (text || "").toLowerCase();
  const tags = [];
  const tagMap = {
    vad: ["vad", "voice activity"],
    rnnoise: ["rnnoise"],
    webrtc: ["webrtc"],
    "noise suppression": ["noise suppression", "noise reduction", "denois"],
    "speech enhancement": ["speech enhancement", "speech processing"],
    diarization: ["diarization", "speaker"],
    whisper: ["whisper"],
    conformer: ["conformer"],
    "speech recognition": ["speech recognition", "asr", "transcri"],
    "real-time audio": ["real-time audio", "realtime audio", "low latency"],
  };
  for (const [tag, triggers] of Object.entries(tagMap)) {
    if (triggers.some((t) => lower.includes(t))) tags.push(tag);
  }
  return tags.length ? tags : ["audio-ai"];
}

function isRecent(dateStr, days) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return true;
  const cutoff = Date.now() - days * 86_400_000;
  return d.getTime() >= cutoff;
}

// ---------------------------------------------------------------------------
// Source fetchers — each returns an array of { title, url, date, source, summary }
// ---------------------------------------------------------------------------

async function fetchReddit(sub) {
  const query = encodeURIComponent(
    "VAD OR RNNoise OR voice activity OR speech processing",
  );
  const url = `https://www.reddit.com/r/${sub}/search.json?q=${query}&sort=new&t=day&limit=${MAX_RESULTS}&restrict_sr=on`;
  const res = await fetch(url, {
    headers: { "User-Agent": "TalkToDoc-TechRadar/1.0" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Reddit r/${sub} returned HTTP ${res.status}`);
  const json = await res.json();
  const posts = json?.data?.children || [];
  return posts
    .map((p) => p.data)
    .filter((p) => matchesKeywords(`${p.title} ${p.selftext || ""}`))
    .map((p) => ({
      title: p.title,
      url: `https://www.reddit.com${p.permalink}`,
      date: new Date(p.created_utc * 1000).toISOString(),
      source: `Reddit r/${sub}`,
      summary: (p.selftext || "").slice(0, 200),
    }));
}

async function fetchAllReddit() {
  const results = [];
  for (const sub of config.subreddits) {
    try {
      const posts = await fetchReddit(sub);
      results.push(...posts);
    } catch (err) {
      console.error(`[tech-radar] Reddit r/${sub} failed: ${err.message}`);
    }
    await sleep(BETWEEN_REQUEST_DELAY_MS);
  }
  return results;
}

async function fetchHackerNews() {
  const queries = ["VAD voice activity", "RNNoise", "WebRTC speech", "speech enhancement noise"];
  const since = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 86_400;
  const results = [];
  for (const q of queries) {
    try {
      const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&numericFilters=created_at_i%3E${since}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HN search returned HTTP ${res.status}`);
      const json = await res.json();
      const hits = (json?.hits || [])
        .filter((h) => matchesKeywords(`${h.title} ${h.story_text || ""}`))
        .map((h) => ({
          title: h.title,
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          date: h.created_at,
          source: "Hacker News",
          summary: h.story_text ? (h.story_text).slice(0, 200) : "",
        }));
      results.push(...hits);
    } catch (err) {
      console.error(`[tech-radar] HN query "${q}" failed: ${err.message}`);
    }
    await sleep(BETWEEN_REQUEST_DELAY_MS);
  }
  return results;
}

async function fetchArxiv() {
  const queries = [
    "all:voice AND all:activity AND all:detection",
    "all:speech AND all:enhancement",
    "all:noise AND all:reduction AND all:speech",
  ];
  const results = [];
  for (const q of queries) {
    try {
      const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}&sortBy=submittedDate&sortOrder=descending&max_results=5`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`arXiv returned HTTP ${res.status}`);
      const xml = await res.text();
      // Minimal XML parsing without external dependencies.
      const entries = xml.split("<entry>").slice(1);
      for (const entry of entries) {
        const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim() || "";
        const link = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || "";
        const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() || "";
        const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim() || "";
        const combined = `${title} ${summary}`;
        if (matchesKeywords(combined) && isRecent(published, LOOKBACK_DAYS + 3)) {
          results.push({
            title,
            url: link,
            date: published,
            source: "arXiv",
            summary: summary.slice(0, 200),
          });
        }
      }
    } catch (err) {
      console.error(`[tech-radar] arXiv query "${q}" failed: ${err.message}`);
    }
    await sleep(BETWEEN_REQUEST_DELAY_MS * 2);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Deduplication & categorisation
// ---------------------------------------------------------------------------

function deduplicate(items) {
  const seen = new Map();
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (!seen.has(key)) seen.set(key, item);
  }
  return [...seen.values()];
}

const CATEGORY_RULES = [
  {
    name: "Voice Activity Detection (VAD)",
    triggers: ["vad", "voice activity", "voice detection", "endpointing"],
  },
  {
    name: "Noise Reduction & Enhancement",
    triggers: ["rnnoise", "noise suppression", "noise reduction", "denois", "enhancement", "super-resolution"],
  },
  {
    name: "Speech Processing & Recognition",
    triggers: ["speech recognition", "whisper", "conformer", "asr", "transcri", "diarization", "speaker"],
  },
  {
    name: "WebRTC & Real-time Audio",
    triggers: ["webrtc", "real-time", "realtime", "low latency", "audio codec", "opus"],
  },
];

function categorise(items) {
  const categories = Object.fromEntries(CATEGORY_RULES.map((c) => [c.name, []]));
  const assigned = new Set();
  for (const item of items) {
    const text = `${item.title} ${item.summary}`.toLowerCase();
    for (const cat of CATEGORY_RULES) {
      if (cat.triggers.some((t) => text.includes(t))) {
        categories[cat.name].push(item);
        assigned.add(item.url);
        break;
      }
    }
  }
  // Items that did not match any specific category go into a general bucket.
  const uncategorised = items.filter((i) => !assigned.has(i.url));
  if (uncategorised.length) {
    categories["Speech Processing & Recognition"].push(...uncategorised);
  }
  return categories;
}

// ---------------------------------------------------------------------------
// Markdown formatting
// ---------------------------------------------------------------------------

function formatItem(item) {
  const date = item.date ? new Date(item.date).toISOString().slice(0, 10) : "unknown";
  const tags = relevanceTags(`${item.title} ${item.summary}`).map((t) => `\`${t}\``).join(" ");
  const summary = item.summary ? ` — ${item.summary.slice(0, 120)}` : "";
  return `- [${item.title}](${item.url}) (${item.source}, ${date}) ${tags}${summary}`;
}

function formatReport(categories) {
  const date = today();
  const lines = [];
  lines.push(`# Tech Radar: Audio/VAD advances — ${date}`);
  lines.push("");
  lines.push(
    `> Automated scan of Reddit, Hacker News, and arXiv for non-verbal analysis technologies.`,
  );
  lines.push("");

  for (const cat of CATEGORY_RULES) {
    lines.push(`## ${cat.name}`);
    lines.push("");
    const items = categories[cat.name];
    if (!items.length) {
      lines.push("_No new findings today._");
    } else {
      for (const item of items) lines.push(formatItem(item));
    }
    lines.push("");
  }

  const total = Object.values(categories).reduce((n, items) => n + items.length, 0);
  lines.push("## Summary & Recommendations");
  lines.push("");
  if (total === 0) {
    lines.push(
      "No significant advances were detected in the last 24 hours. This is normal for niche topics — consider expanding the lookback window or keyword list if this persists.",
    );
  } else {
    lines.push(`Detected **${total}** relevant item(s) across all sources.`);
    lines.push("");
    for (const cat of CATEGORY_RULES) {
      const count = categories[cat.name].length;
      if (count) lines.push(`- **${cat.name}**: ${count} item(s)`);
    }
    lines.push("");
    lines.push(
      "Review the items above and close this issue if no action is needed. For items that affect the project's audio pipeline, open a dedicated issue linked to this radar.",
    );
  }
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.error(`[tech-radar] scanning sources (lookback: ${LOOKBACK_DAYS} day(s))...`);

  const [reddit, hn, arxiv] = await Promise.allSettled([
    fetchAllReddit(),
    fetchHackerNews(),
    fetchArxiv(),
  ]);

  const all = [];
  if (reddit.status === "fulfilled") all.push(...reddit.value);
  else console.error(`[tech-radar] Reddit batch failed: ${reddit.reason?.message}`);
  if (hn.status === "fulfilled") all.push(...hn.value);
  else console.error(`[tech-radar] HN batch failed: ${hn.reason?.message}`);
  if (arxiv.status === "fulfilled") all.push(...arxiv.value);
  else console.error(`[tech-radar] arXiv batch failed: ${arxiv.reason?.message}`);

  console.error(`[tech-radar] raw results: ${all.length}`);

  const unique = deduplicate(all);
  console.error(`[tech-radar] after dedup: ${unique.length}`);

  const categories = categorise(unique);
  const report = formatReport(categories);

  // Output the report to stdout for consumption by the workflow or local use.
  process.stdout.write(report);
}

main().catch((err) => {
  console.error(`[tech-radar] fatal: ${err.message}`);
  process.exitCode = 1;
});
