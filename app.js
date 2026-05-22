/**
 * ============================================================
 *  SOLOHIVE — app.js  (v2.0)
 *  Clean rewrite consolidating all features and fixes.
 *
 *  Sections:
 *   1. Page init helpers (favicon, analytics, dark mode, OG tags)
 *   2. Hive API calls
 *   3. Content sanitizers (post body, comment body)
 *   4. Renderers (markdown, mentions/tags)
 *   5. Utility helpers
 *   6. Sidebar
 *   7. Index page (post list, pagination)
 *   8. Post page (single post, comments)
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
//  1. PAGE INIT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function initFavicon() {
  if (!BLOG_CONFIG.favicon) return;
  const link = document.createElement("link");
  link.rel  = "icon";
  link.href = BLOG_CONFIG.favicon;
  document.head.appendChild(link);
}

function initAnalytics() {
  if (!BLOG_CONFIG.analyticsCode || !BLOG_CONFIG.analyticsCode.trim()) return;
  const div = document.createElement("div");
  div.innerHTML = BLOG_CONFIG.analyticsCode.trim();
  Array.from(div.childNodes).forEach(node => {
    if (node.tagName === "SCRIPT") {
      const script = document.createElement("script");
      Array.from(node.attributes).forEach(attr =>
        script.setAttribute(attr.name, attr.value));
      if (node.textContent) script.textContent = node.textContent;
      document.head.appendChild(script);
    } else {
      document.head.appendChild(node.cloneNode(true));
    }
  });
}

function initDarkMode() {
  const btn  = document.getElementById("dark-mode-toggle");
  const root = document.documentElement;

  const saved       = localStorage.getItem("hiveblog-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark      = saved ? saved === "dark" : prefersDark;

  if (isDark) root.setAttribute("data-theme", "dark");
  updateToggleLabel(btn, isDark);

  if (btn) {
    btn.addEventListener("click", () => {
      const nowDark = root.getAttribute("data-theme") === "dark";
      if (nowDark) {
        root.removeAttribute("data-theme");
        localStorage.setItem("hiveblog-theme", "light");
        updateToggleLabel(btn, false);
      } else {
        root.setAttribute("data-theme", "dark");
        localStorage.setItem("hiveblog-theme", "dark");
        updateToggleLabel(btn, true);
      }
    });
  }
}

function updateToggleLabel(btn, isDark) {
  if (!btn) return;
  btn.textContent = isDark ? "☀ Light" : "☾ Dark";
  btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

// ── Open Graph & Twitter Card tags ───────────────────────────────────────────

function setMeta(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.setAttribute("content", value);
}

// Resolve ogDefaultImage to a full URL
function ogImageUrl() {
  if (!BLOG_CONFIG.ogDefaultImage) return "";
  const base = BLOG_CONFIG.siteUrl || "";
  return BLOG_CONFIG.ogDefaultImage.startsWith("http")
    ? BLOG_CONFIG.ogDefaultImage
    : `${base}/${BLOG_CONFIG.ogDefaultImage}`;
}

function setIndexOpenGraph() {
  const img = ogImageUrl();
  document.title = BLOG_CONFIG.siteTitle;
  setMeta("og-site-name",   BLOG_CONFIG.siteTitle);
  setMeta("og-title",       BLOG_CONFIG.siteTitle);
  setMeta("og-description", BLOG_CONFIG.siteTagline);
  setMeta("og-url",         BLOG_CONFIG.siteUrl || "");
  setMeta("og-image",       img);
  setMeta("tw-title",       BLOG_CONFIG.siteTitle);
  setMeta("tw-description", BLOG_CONFIG.siteTagline);
  setMeta("tw-image",       img);
}

function setPostOpenGraph(post) {
  const base    = BLOG_CONFIG.siteUrl || "";
  const postUrl = `${base}/post.html?author=${post.author}&permlink=${post.permlink}`;
  const excerpt = excerptFrom(post.body).slice(0, 160);
  const img     = extractImage(post) || ogImageUrl();
  setMeta("og-site-name",   BLOG_CONFIG.siteTitle);
  setMeta("og-title",       post.title);
  setMeta("og-description", excerpt);
  setMeta("og-url",         postUrl);
  setMeta("og-image",       img);
  setMeta("tw-title",       post.title);
  setMeta("tw-description", excerpt);
  setMeta("tw-image",       img);
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. HIVE API
// ─────────────────────────────────────────────────────────────────────────────

// Fallback nodes tried in order if the primary node fails.
// The configured hiveNode is always tried first.
const FALLBACK_NODES = [
  "https://api.hive.blog",
  "https://rpc.ecency.com",
  "https://api.openhive.network",
  "https://anyx.io",
];

// Returns an ordered list of nodes to try — configured node first,
// then fallbacks (deduped so we don't try the same node twice).
function getNodeList() {
  const primary = (BLOG_CONFIG.hiveNode || "https://api.hive.blog").trim();
  return [primary, ...FALLBACK_NODES.filter(n => n !== primary)];
}

async function hiveCall(method, params) {
  const nodes   = getNodeList();
  const body    = JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 });
  let   lastErr = null;

  for (const node of nodes) {
    try {
      const res  = await fetch(node, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.result;
    } catch (err) {
      console.warn(`SoloHive: node ${node} failed — ${err.message}`);
      lastErr = err;
      // Short delay before trying next node
      await new Promise(r => setTimeout(r, 300));
    }
  }

  throw lastErr; // all nodes failed
}

// Fetch posts for the index page.
// Handles both single-user blogs and community feeds.
// Keeps fetching in batches until we have pageSize+1 qualifying posts
// (the extra one lets us detect whether an older page exists).
// Max 5 batches to prevent infinite loops when reblogs dominate the feed.
async function fetchPostsFiltered(startAuthor, startPermlink) {
  const need      = pageSize + 1;
  const batchSize = 20; // Hive API hard cap
  const maxBatches = 5; // prevent infinite loops
  const community = isCommunityMode();
  const collected = [];
  let curAuthor   = startAuthor;
  let curPerm     = startPermlink;
  let firstBatch  = true;
  let batchCount  = 0;

  while (collected.length < need && batchCount < maxBatches) {
    const params = {
      tag:   community ? BLOG_CONFIG.hiveCommunity.trim() : BLOG_CONFIG.hiveUsername,
      limit: batchSize,
    };
    if (curAuthor) params.start_author   = curAuthor;
    if (curPerm)   params.start_permlink = curPerm;

    const method = community
      ? "condenser_api.get_discussions_by_created"
      : "condenser_api.get_discussions_by_blog";

    const batch = await hiveCall(method, [params]);
    if (!batch || batch.length === 0) break;

    // Hive cursors are inclusive — skip the first item on subsequent batches
    const items = firstBatch ? batch : batch.slice(1);
    firstBatch  = false;
    batchCount++;

    for (const post of items) {
      if (!community && post.author !== BLOG_CONFIG.hiveUsername) continue; // skip reblogs
      if (BLOG_CONFIG.defaultTag && !extractTags(post).includes(BLOG_CONFIG.defaultTag)) continue;
      collected.push(post);
      if (collected.length >= need) break;
    }

    if (batch.length < batchSize) break; // no more posts on chain

    // Advance cursor using the last item in the batch
    const last = batch[batch.length - 1];
    curAuthor   = last.author;
    curPerm     = last.permlink;
  }

  return collected;
}

async function fetchPost(author, permlink) {
  return hiveCall("condenser_api.get_content", [author, permlink]);
}

async function fetchComments(author, permlink) {
  return hiveCall("condenser_api.get_content_replies", [author, permlink]);
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. CONTENT SANITIZERS
// ─────────────────────────────────────────────────────────────────────────────

// Sanitize post body before passing to marked.js.
// Handles the mix of markdown and HTML that Hive posting apps produce.
function sanitizePostBody(body) {
  if (!body) return "";
  return body
    // Remove <center> tags — marked.js won't parse markdown inside HTML blocks
    .replace(/<\/?center>/gi, "")

    // Flatten markdown pipe tables — images in table cells don't render
    .replace(/(?:^|\n)((?:\|[^\n]+\|\n?)+)/gm, (match, table) => {
      const rows = table.trim().split("\n")
        .filter(row => !/^\|[\s:|−-]+\|/.test(row.trim())); // skip separator rows
      const cells = [];
      rows.forEach(row => {
        row.split("|").forEach(cell => {
          const trimmed = cell.trim();
          if (trimmed) cells.push(trimmed);
        });
      });
      return cells.length ? "\n\n" + cells.join("\n\n") + "\n\n" : "";
    })

    // Convert YouTube URLs to responsive embeds
    .replace(
      /(?:^|\n)([ \t]*(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})[^\s\n]*)/gm,
      (match, full, videoId) => {
        const tMatch = full.match(/[?&]t=(\d+)/);
        const start  = tMatch ? `&start=${tMatch[1]}` : "";
        return `\n\n<div class="yt-embed"><iframe src="https://www.youtube.com/embed/${videoId}?rel=0${start}" frameborder="0" allowfullscreen loading="lazy" title="YouTube video"></iframe></div>\n\n`;
      }
    )

    // Ensure back-to-back images get their own lines
    .replace(/(!\[[^\]]*\]\([^)]+\))(!\[[^\]]*\]\([^)]+\))/g, "$1\n\n$2")
    // Ensure image followed immediately by text gets a line break
    .replace(/(!\[[^\]]*\]\([^)]+\))([^\n])/g, "$1\n\n$2")
    // Convert <br> tags to newlines
    .replace(/<br\s*\/?>/gi, "\n")
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Sanitize comment body before passing to marked.js.
// Comments come from many different Hive apps with varying formatting habits.
function sanitizeCommentBody(body) {
  if (!body) return "";
  return body
    // Flatten HTML tables (HiveBuzz and other bots use these)
    .replace(/<\/td>\s*<td[^>]*>/gi, "\n\n")
    .replace(/<\/th>\s*<th[^>]*>/gi, "\n\n")
    .replace(/<t[rdh][^>]*>|<\/t[rdh]>|<t(?:head|body|foot)[^>]*>|<\/t(?:head|body|foot)>|<table[^>]*>|<\/table>/gi, "")

    // Normalise image syntax
    .replace(/!\[\s*\]\(\s*(https?:\/\/[^)]+?)\s*\)/g, "![]($1)")    // fix empty alt with spaces
    .replace(/(!\[[^\]]*\]\([^)]+\))\t+/g, "$1\n\n")                  // tab after image → newline
    .replace(/^(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg))(\s*)$/gim, "![]($1)") // bare image URLs
    .replace(/<img[^>]+src=["']([^"']+)["'][^>]*\/?>/gi, "![]($1)")  // HTML img tags

    // Convert HTML to markdown-friendly equivalents
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?center>/gi, "")

    // Single newlines → double so marked.js creates proper paragraphs (run twice)
    .replace(/([^\n])\n([^\n])/g, "$1\n\n$2")
    .replace(/([^\n])\n([^\n])/g, "$1\n\n$2")

    // Strip remaining inline HTML but keep text content
    .replace(/<\/?(?:div|span|p|strong|em|b|i|sub|sup)[^>]*>/gi, "")

    // Collapse 3+ blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. RENDERERS
// ─────────────────────────────────────────────────────────────────────────────

function renderMarkdown(md) {
  if (!md) return "";

  // DOMPurify is required for safe rendering. If it failed to load
  // we show an error rather than risk XSS attacks on visitors.
  if (typeof DOMPurify === "undefined") {
    console.error("SoloHive: DOMPurify failed to load. Content rendering blocked for visitor safety.");
    return `<p class="error-state">Content could not be displayed safely. Please try refreshing the page.</p>`;
  }

  if (typeof marked !== "undefined") {
    const raw = marked.parse(md);
    // Sanitize to prevent XSS from malicious Hive post content.
    // Strips script tags, event handlers, and javascript: URLs
    // while preserving safe HTML like headings, images, links, and formatting.
    return DOMPurify.sanitize(raw, {
      ADD_TAGS:    ["iframe"],
      ADD_ATTR:    ["allowfullscreen", "loading", "frameborder", "title"],
      FORBID_TAGS: ["script", "style"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
    });
  }

  // Basic fallback if marked.js CDN fails to load — still sanitized via escaping
  return DOMPurify.sanitize(md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^#{3}\s(.+)/gm, "<h3>$1</h3>")
    .replace(/^#{2}\s(.+)/gm, "<h2>$1</h2>")
    .replace(/^#{1}\s(.+)/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    .replace(/`(.+?)`/g,       "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g,  '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1">')
    .replace(/\n\n/g, "</p><p>")
  );
}

// Walk rendered HTML and link @mentions and #hashtags.
// Only processes text nodes to avoid double-linking existing anchors or
// touching content inside <code> and <pre> blocks.
function linkMentionsAndTags(html) {
  const div  = document.createElement("div");
  div.innerHTML = html;
  const base = frontendBase();

  function processNode(node) {
    if (node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();
      if (tag === "a" || tag === "code" || tag === "pre") return;
      node.childNodes.forEach(processNode);
      return;
    }
    if (node.nodeType !== 3) return;

    const text = node.textContent;
    if (!text) return;
    if (!/@[a-z0-9._-]{3,}/i.test(text) && !/#[a-z0-9-]{2,}/i.test(text)) return;

    const replaced = text
      .replace(/@([a-z0-9._-]{3,})/gi,
        (_, user) => `<a href="${base}/@${user}" target="_blank" rel="noopener">@${user}</a>`)
      .replace(/#([a-z0-9-]{2,})/gi,
        (_, tag)  => `<a href="${base}/trending/${tag}" target="_blank" rel="noopener">#${tag}</a>`);

    if (replaced !== text) {
      const span = document.createElement("span");
      span.innerHTML = replaced;
      node.parentNode.replaceChild(span, node);
    }
  }

  div.childNodes.forEach(processNode);
  return div.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
//  5. UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Returns true when a Hive community tag is configured
function isCommunityMode() {
  return !!(BLOG_CONFIG.hiveCommunity && BLOG_CONFIG.hiveCommunity.trim());
}

// Returns the configured frontend base URL with no trailing slash
function frontendBase() {
  const f = (BLOG_CONFIG.hiveFrontend || "hive.blog").trim().replace(/\/$/, "");
  return f.startsWith("http") ? f : `https://${f}`;
}

// Decode Hive's raw reputation integer to the familiar 0-100 scale
function decodeReputation(raw) {
  if (raw === null || raw === undefined) return 25;
  const rep = parseInt(raw, 10);
  if (rep === 0) return 25;
  const isNeg = rep < 0;
  const score = Math.max(Math.log10(Math.abs(rep)) - 9, 0) * 9 + 25;
  return Math.round(isNeg ? 50 - (score - 25) : score);
}

// Returns the configured minimum comment reputation threshold
// -1 = show all; 0 = hide negative rep (default); 25 = hide new/spam accounts
function minReputation() {
  const v = parseInt(BLOG_CONFIG.minCommentReputation);
  return isNaN(v) ? 0 : v;
}

function timeAgo(dateStr) {
  const secs = Math.floor((Date.now() - new Date(dateStr + "Z")) / 1000);
  if (secs < 60)    return "just now";
  if (secs < 3600)  return Math.floor(secs / 60)   + "m ago";
  if (secs < 86400) return Math.floor(secs / 3600) + "h ago";
  return Math.floor(secs / 86400) + "d ago";
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "Z");
  return d.toLocaleDateString("en-US", {
    year:     "numeric",
    month:    "long",
    day:      "numeric",
    timeZone: "UTC",   // prevent date shifting across timezones
  });
}

// Normalize a URL — handles protocol-relative and relative URLs
function normalizeUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/") && BLOG_CONFIG.siteUrl) return `${BLOG_CONFIG.siteUrl}${url}`;
  return url;
}

// Extract the first image URL from a post (checks json_metadata first, then body)
function extractImage(post) {
  try {
    const meta = JSON.parse(post.json_metadata);
    if (meta.image && meta.image[0]) return normalizeUrl(meta.image[0]);
  } catch (_) {}
  const m = post.body.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
  return m ? normalizeUrl(m[1]) : null;
}

// Extract tags from a post's json_metadata
function extractTags(post) {
  try { return JSON.parse(post.json_metadata).tags || []; }
  catch (_) { return []; }
}

// Build a clean plain-text excerpt from raw Markdown
function excerptFrom(body) {
  return (body || "")
    .replace(/!\[.*?\]\(.*?\)/g, "")          // remove images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // links → label text
    .replace(/^#{1,6}\s+/gm, "")              // headings
    .replace(/(\*\*|__)(.*?)\1/g, "$2")       // bold
    .replace(/(\*|_)(.*?)\1/g, "$2")          // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, "")        // code
    .replace(/<[^>]+>/g, "")                  // HTML tags
    .replace(/https?:\/\/\S+/g, "")           // bare URLs
    .replace(/[#>|~^]/g, "")                  // leftover markdown chars
    .replace(/\s+/g, " ")                     // collapse whitespace
    .trim()
    .slice(0, 200)
    .trim();
}

function postUrl(post) {
  return `post.html?author=${post.author}&permlink=${post.permlink}`;
}

// Get vote count — falls back to active_votes.length if net_votes is missing
function voteCount(post) {
  const nv = parseInt(post.net_votes);
  if (!isNaN(nv)) return nv;
  return Array.isArray(post.active_votes) ? post.active_votes.length : 0;
}

function payout(post) {
  const pending = parseFloat(post.pending_payout_value)  || 0;
  const paid    = (parseFloat(post.total_payout_value)   || 0)
                + (parseFloat(post.curator_payout_value) || 0);
  return `$${(pending + paid).toFixed(2)}`;
}

// Copy a URL to clipboard with visual confirmation on the button
function copyPostLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.querySelector(".share-copy");
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
      btn.classList.add("share-copy--success");
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove("share-copy--success"); }, 2000);
    }
  }).catch(() => prompt("Copy this link:", url));
}

// ─────────────────────────────────────────────────────────────────────────────
//  6. SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────

function renderSidebar() {
  const s      = BLOG_CONFIG.sidebar;
  const soc    = BLOG_CONFIG.social;
  const avatar = `https://images.hive.blog/u/${BLOG_CONFIG.hiveUsername}/avatar`;

  const socialLinks = [
    soc.hive      && `<a href="${frontendBase()}/@${soc.hive}" target="_blank" rel="noopener" title="Hive">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4l4 8H8l4-8zm0 16l-4-8h8l-4 8z"/></svg></a>`,
    soc.twitter   && `<a href="https://twitter.com/${soc.twitter}" target="_blank" rel="noopener" title="Twitter/X">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>`,
    soc.instagram && `<a href="https://instagram.com/${soc.instagram}" target="_blank" rel="noopener" title="Instagram">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>`,
    soc.youtube   && `<a href="https://youtube.com/@${soc.youtube}" target="_blank" rel="noopener" title="YouTube">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>`,
    soc.website   && `<a href="${soc.website}" target="_blank" rel="noopener" title="Website">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg></a>`,
  ].filter(Boolean).join("");

  const aboutHtml = s.aboutText ? `
    <div class="sidebar-widget about-widget">
      <img src="${avatar}" alt="${BLOG_CONFIG.hiveUsername}" class="avatar">
      <h3 class="site-name-sidebar">${BLOG_CONFIG.siteTitle}</h3>
      <p class="about-text">${s.aboutText}</p>
      ${socialLinks ? `<div class="social-links">${socialLinks}</div>` : ""}
    </div>` : "";

  const w1 = s.widget1 ? `<div class="sidebar-widget custom-widget">${s.widget1}</div>` : "";
  const w2 = s.widget2 ? `<div class="sidebar-widget custom-widget">${s.widget2}</div>` : "";
  const w3 = s.widget3 ? `<div class="sidebar-widget custom-widget">${s.widget3}</div>` : "";

  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.innerHTML = aboutHtml + w1 + w2 + w3;
}

// ─────────────────────────────────────────────────────────────────────────────
//  7. INDEX PAGE
// ─────────────────────────────────────────────────────────────────────────────

// Hive API hard cap is 20; we fetch pageSize+1 to detect next page,
// so max displayable per page is 19.
const pageSize = Math.min(Math.max(1, parseInt(BLOG_CONFIG.postsPerPage) || 10), 19);

// Pagination history stored in sessionStorage so browser back/forward works.
// Each entry is a {author, permlink} cursor representing the first post of that page.
// Empty stack = page 1.
function getPageHistory() {
  try {
    return JSON.parse(sessionStorage.getItem("solohive-page-history") || "[]");
  } catch (_) { return []; }
}

function setPageHistory(history) {
  try {
    sessionStorage.setItem("solohive-page-history", JSON.stringify(history));
  } catch (_) {}
}

function clearPageHistory() {
  try { sessionStorage.removeItem("solohive-page-history"); } catch (_) {}
}

function initPage(isPost) {
  const el = (id) => document.getElementById(id);
  const titleEl = el("site-title");
  if (titleEl) {
    titleEl.textContent = BLOG_CONFIG.siteTitle;
    if (isPost) titleEl.href = "index.html";
  }
  if (el("site-tagline")) el("site-tagline").textContent = BLOG_CONFIG.siteTagline;
  if (el("footer-text"))  el("footer-text").textContent  = BLOG_CONFIG.footerText;
  const fw = el("footer-widget");
  if (fw && BLOG_CONFIG.footerWidget) fw.innerHTML = BLOG_CONFIG.footerWidget;
  initFavicon();
  initAnalytics();
  initDarkMode();
  renderSidebar();
}

async function initIndex() {
  initPage(false);
  setIndexOpenGraph();

  // On back navigation restore the saved cursor so the user lands on
  // the same page they were on. On fresh visits clear the history.
  const navType = performance.getEntriesByType("navigation")[0]?.type;
  if (navType === "back_forward") {
    const history = getPageHistory();
    const cursor  = history[history.length - 1];
    await loadPostList(cursor?.author, cursor?.permlink);
  } else {
    clearPageHistory();
    await loadPostList();
  }
}

async function loadPostList(startAuthor, startPermlink) {
  const container = document.getElementById("post-list");
  const loading   = document.getElementById("loading");

  if (loading)   loading.style.display = "block";
  if (container) container.innerHTML   = "";

  try {
    const posts   = await fetchPostsFiltered(startAuthor, startPermlink);
    const hasNext = posts.length > pageSize;
    const visible = hasNext ? posts.slice(0, pageSize) : posts;
    const history = getPageHistory();
    const hasPrev = history.length > 0;

    if (loading) loading.style.display = "none";

    if (!visible.length) {
      container.innerHTML = `<p class="empty-state">No posts found.</p>`;
      renderPagination(hasPrev, false);
      return;
    }

    visible.forEach((post, i) => {
      const img  = extractImage(post);
      const tags = extractTags(post).slice(0, 3);
      const card = document.createElement("article");
      card.className = "post-card";
      card.style.animationDelay = `${i * 60}ms`;

      card.innerHTML = `
        ${img ? `<a href="${postUrl(post)}" class="card-image-link">
          <div class="card-image" style="background-image:url('${img}')"></div>
        </a>` : ""}
        <div class="card-body">
          <div class="card-meta">
            <span class="card-date">${formatDate(post.created)}</span>
            ${tags.map(t => `<span class="tag">${t}</span>`).join("")}
          </div>
          <h2 class="card-title">
            <a href="${postUrl(post)}">${post.title || "Untitled"}</a>
          </h2>
          <p class="card-excerpt">${excerptFrom(post.body)}…</p>
          <div class="card-footer">
            <a href="${postUrl(post)}" class="read-more">Read more →</a>
            <span class="card-stats">
              <span title="Votes">♥ ${voteCount(post)}</span>
              <span title="Payout">${payout(post)}</span>
            </span>
          </div>
        </div>`;

      container.appendChild(card);
    });

    const lastPost = visible[visible.length - 1];
    renderPagination(
      hasPrev,
      hasNext,
      () => {
        // ← Newer: pop current cursor and reload from previous page
        const h = getPageHistory();
        h.pop();
        setPageHistory(h);
        const cursor = h[h.length - 1];
        loadPostList(cursor?.author, cursor?.permlink);
      },
      () => {
        // Older →: push last post as cursor for next page
        const h = getPageHistory();
        h.push({ author: lastPost.author, permlink: lastPost.permlink });
        setPageHistory(h);
        loadPostList(lastPost.author, lastPost.permlink);
      }
    );

  } catch (err) {
    if (loading)   loading.style.display = "none";
    if (container) container.innerHTML =
      `<p class="error-state">Could not load posts. Please try again later.<br><small>${err.message}</small></p>`;
    console.error(err);
  }
}

function renderPagination(hasPrev, hasNext, onPrev, onNext) {
  const pagination = document.getElementById("pagination");
  if (!pagination) return;
  pagination.innerHTML = "";

  const prevBtn       = document.createElement("button");
  prevBtn.className   = "page-btn";
  prevBtn.textContent = "← Newer";
  prevBtn.disabled    = !hasPrev;
  if (hasPrev) prevBtn.onclick = onPrev;

  const nextBtn       = document.createElement("button");
  nextBtn.className   = "page-btn";
  nextBtn.textContent = "Older →";
  nextBtn.disabled    = !hasNext;
  if (hasNext) nextBtn.onclick = onNext;

  pagination.appendChild(prevBtn);
  pagination.appendChild(nextBtn);
}

// ─────────────────────────────────────────────────────────────────────────────
//  8. POST PAGE
// ─────────────────────────────────────────────────────────────────────────────

async function initPost() {
  const params   = new URLSearchParams(window.location.search);
  const author   = params.get("author");
  const permlink = params.get("permlink");

  if (!author || !permlink) { window.location = "index.html"; return; }

  initPage(true);

  const loading = document.getElementById("loading");
  const content = document.getElementById("post-content");

  try {
    const [post, allComments] = await Promise.all([
      fetchPost(author, permlink),
      fetchComments(author, permlink),
    ]);

    if (loading) loading.style.display = "none";
    document.title = `${post.title} — ${BLOG_CONFIG.siteTitle}`;
    setPostOpenGraph(post);

    // Filter spam comments by reputation
    const threshold   = minReputation();
    const comments    = threshold < 0
      ? allComments
      : allComments.filter(c => decodeReputation(c.author_reputation) > threshold);
    const hiddenCount = allComments.length - comments.length;

    const tags = extractTags(post);

    content.innerHTML = `
      <article class="full-post">
        <header class="post-header">
          <div class="post-meta-top">
            <a href="index.html" class="back-link">← Back</a>
            <span class="post-date">${formatDate(post.created)}</span>
          </div>
          <h1 class="post-title">${post.title}</h1>
          <div class="post-byline">
            <a href="${frontendBase()}/@${post.author}" target="_blank" rel="noopener" class="byline-author-link">
              <img src="https://images.hive.blog/u/${post.author}/avatar/small"
                   class="byline-avatar" alt="${post.author}">
              <span>by <strong>@${post.author}</strong></span>
            </a>
            <span class="post-stats">♥ ${voteCount(post)} · ${payout(post)}</span>
          </div>
          ${tags.length
            ? `<div class="post-tags">${tags.map(t => `<span class="tag">${t}</span>`).join("")}</div>`
            : ""}
        </header>

        <div class="post-body">
          ${linkMentionsAndTags(renderMarkdown(sanitizePostBody(post.body)))}
        </div>

        <footer class="post-footer">
          <div class="share-section">
            <span class="share-label">Share</span>
            <div class="share-buttons">
              <a class="share-btn share-twitter"
                 href="https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent((BLOG_CONFIG.siteUrl || "") + '/post.html?author=' + post.author + '&permlink=' + post.permlink)}"
                 target="_blank" rel="noopener" title="Share on Twitter/X">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                X / Twitter
              </a>
              <a class="share-btn share-facebook"
                 href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent((BLOG_CONFIG.siteUrl || "") + '/post.html?author=' + post.author + '&permlink=' + post.permlink)}"
                 target="_blank" rel="noopener" title="Share on Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </a>
              <a class="share-btn share-linkedin"
                 href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent((BLOG_CONFIG.siteUrl || "") + '/post.html?author=' + post.author + '&permlink=' + post.permlink)}"
                 target="_blank" rel="noopener" title="Share on LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </a>
              <button class="share-btn share-copy"
                onclick="copyPostLink('${(BLOG_CONFIG.siteUrl || "") + "/post.html?author=" + post.author + "&permlink=" + post.permlink}')"
                title="Copy link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                Copy Link
              </button>
            </div>
          </div>
          <a href="${frontendBase()}/@${post.author}/${post.permlink}"
             target="_blank" rel="noopener" class="hive-link">
            View on Hive →
          </a>
        </footer>
      </article>

      <section class="comments">
        <h3 class="comments-title">
          ${comments.length} Comment${comments.length !== 1 ? "s" : ""}
          ${hiddenCount > 0
            ? `<span class="hidden-count">(${hiddenCount} hidden — low reputation)</span>`
            : ""}
        </h3>
        ${comments.length
          ? comments.map(c => `
              <div class="comment">
                <div class="comment-author">
                  <a href="${frontendBase()}/@${c.author}" target="_blank" rel="noopener" class="comment-author-link">
                    <img src="https://images.hive.blog/u/${c.author}/avatar/small"
                         alt="${c.author}" class="comment-avatar">
                    <strong>@${c.author}</strong>
                  </a>
                  <span class="rep-badge" title="Reputation">${decodeReputation(c.author_reputation)}</span>
                  <span class="comment-time">${timeAgo(c.created)}</span>
                </div>
                <div class="comment-body">${renderMarkdown(sanitizeCommentBody(c.body))}</div>
              </div>`).join("")
          : `<p class="empty-state" style="padding:1.5rem 0">No comments yet.</p>`
        }
      </section>
    `;

    // Hide comment images that fail to load (dead links, 404s)
    setTimeout(() => {
      document.querySelectorAll(".comment-body img").forEach(img => {
        img.addEventListener("error", () => img.setAttribute("data-error", "1"));
        if (img.complete && img.naturalHeight === 0) img.setAttribute("data-error", "1");
      });
    }, 100);

  } catch (err) {
    if (loading) loading.style.display = "none";
    content.innerHTML =
      `<p class="error-state">Could not load post.<br><small>${err.message}</small></p>`;
    console.error(err);
  }
}
