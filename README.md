# SoloHive

A self-hosted blog engine that displays your Hive blockchain content on your own domain.
Your posts live on Hive — this script presents them beautifully on a site you fully control.

**No database. No server-side code. Works on any web host that serves HTML files.**

---

## Why Use This?

- Your content stays on Hive — censorship resistant and permanently stored on-chain
- Your website is yours — your domain, your design, your monetization
- Run ads or affiliate links on your site without risking Hive downvotes
- No reliance on PeakD, Hive.blog, Ecency, or any other frontend
- Free or very low cost to host
- XSS protection built in — visitor safety is a priority

---

## Quick Start

### 1. Download the files

You need these 6 files:

```
index.html      ← post list page
post.html       ← single post page
app.js          ← Hive API logic (no need to edit this)
style.css       ← all the styling
config.js       ← YOUR settings — the only file you need to edit
favicon.svg     ← default SoloHive favicon (replace with your own)
```

### 2. Edit config.js

Open `config.js` in any text editor (Notepad, TextEdit, VS Code, anything).

**Required settings:**

```js
hiveUsername: "yourusername",           // Your Hive account name — no @
siteTitle:    "My Blog",                // Your site name
siteTagline:  "Thoughts, ideas, and more.",
siteUrl:      "https://yourdomain.com", // Your domain — used for share links
```

**Optional — choose your preferred Hive frontend:**

Links to author profiles, @mentions, and #hashtags all point to this frontend.
Defaults to `hive.blog` if not set.

```js
hiveFrontend: "hive.blog",   // or "peakd.com", "ecency.com", "inleo.io", etc.
```

**Optional — show posts from a Hive community instead of your account:**

```js
hiveCommunity: "hive-174578",  // leave "" for single-user mode
```

**Optional — filter to one tag only:**

```js
defaultTag: "photography",  // leave "" to show all posts
```

**Posts per page** (maximum 19 due to Hive API limits):

```js
postsPerPage: 10,
```

**Optional — set your blog language** (helps screen readers and search engines):

```js
htmlLang: "en",  // e.g. "es", "fr", "de", "pt", "ja"
```

### 3. Add your social links

Fill in whichever you use — leave the rest as `""` to hide them:

```js
social: {
  hive:      "yourusername",
  twitter:   "yourhandle",
  instagram: "",
  youtube:   "",
  website:   "",
},
```

### 4. Add a favicon (optional)

A default `favicon.svg` is included. To use your own, drop an image file
(SVG, PNG, or ICO) in the same folder as your HTML files and update:

```js
favicon: "favicon.png",
```

Or use a full URL to any image online.

### 5. Add sidebar widgets (optional)

Got an AdSense snippet? A Buy Me a Coffee button? An Amazon banner? An email signup form?
Paste the HTML code between the backticks:

```js
sidebar: {
  aboutText: "Hi! I write about tech and travel.",

  widget1: `
    <!-- paste any HTML snippet here -->
    <a href="https://www.buymeacoffee.com/yourname">
      <img src="https://img.buymeacoffee.com/button-api/...">
    </a>
  `,

  widget2: ``,  // leave empty to hide
  widget3: ``,
},
```

### 6. Add a footer widget (optional)

Paste any HTML snippet for a banner or disclosure that appears at the bottom of every page:

```js
footerWidget: `
  <p>This site contains affiliate links.</p>
`,
```

### 7. Set comment filtering (optional)

Hide spam comments by reputation score. Uses the same 0–100 scale as PeakD:

```js
minCommentReputation: 0,   // 0 = hide negative rep accounts (default)
                           // 25 = hide new/untrusted accounts
                           // -1 = show all comments
```

### 8. Add analytics (optional)

Paste your analytics script snippet between the backticks. Works with Google Analytics,
Cloudflare Analytics, Plausible, Fathom, or any tracker that uses a script tag.

> ⚠️ **Security warning:** Only paste code from trusted, well-known providers.
> Never paste code from unknown sources — scripts placed here execute on your visitors' browsers.

```js
analyticsCode: `
  <!-- paste your analytics snippet here -->
`,
```

### 9. Set up Open Graph tags (optional but recommended)

Open Graph tags make your posts look great when shared on Twitter/X, Facebook, LinkedIn,
and Discord — showing a title, description, and image preview card instead of a bare link.

Open `index.html` and `post.html` in a text editor and find the Open Graph comment block
near the top. Update these values to match your site:

```html
<meta property="og:site_name" content="Your Site Name">
<meta property="og:title"     content="Your Site Name">
<meta property="og:description" content="Your site tagline here.">
<meta property="og:url"       content="https://yourdomain.com">
```

For post pages, `app.js` automatically fills in the actual post title, description,
and cover image for visitors — the static values are only used by social crawlers
that don't run JavaScript.

To set a fallback image for posts with no cover image, add a URL to `ogDefaultImage`
in `config.js`. Recommended size: 1200x630px.

```js
ogDefaultImage: "https://yourdomain.com/og-image.png",
```

### 10. Upload to your host

Upload all 6 files to your web host's public folder (usually `public_html` or `www`).

Visit your domain — your Hive posts will appear automatically.

---

## Customizing the Design

All visual settings live in CSS variables at the top of `style.css`.
Open the file and find the `:root { }` block:

```css
:root {
  --color-accent: #c0392b;   /* ← your brand color */
  --color-bg:     #faf9f7;   /* page background     */
  --color-text:   #1a1815;   /* main text color     */
  --color-muted:  #7a756e;   /* secondary text      */
  --sidebar-w:    280px;     /* sidebar width       */
}
```

Change `--color-accent` to your brand color and you're most of the way there.
Everything in the design — buttons, tags, links, hover states — inherits from these variables.

---

## Features

- **Post list** with cover images, tags, excerpts, vote counts, and payout values
- **Single post view** with full Markdown rendering — headings, images, code blocks, tables
- **YouTube embeds** — bare YouTube URLs in posts render as embedded players automatically
- **@mention and #hashtag linking** — clickable links pointing to your configured Hive frontend
- **Clickable authors** — avatars and usernames link to author profiles
- **Dark mode** toggle with preference saved between visits — also respects your OS setting
- **Sidebar** with avatar, about text, social links, and 3 paste-in widget slots
- **Footer widget** slot for banners or disclosures
- **Social share buttons** on every post — Twitter/X, Facebook, LinkedIn, and copy link
- **Open Graph / Twitter Card** meta tags for rich social sharing previews
- **Analytics slot** — paste any tracking snippet into config
- **Pagination** with browser back/forward support
- **Comments** pulled from the Hive blockchain with reputation filtering
- **Community mode** — show posts from a Hive community instead of a single user
- **Configurable Hive frontend** — links can point to PeakD, Ecency, Inleo, or any frontend
- **Favicon** support via config
- **Responsive** — works on desktop, tablet, and mobile
- **XSS protection** via DOMPurify — visitor safety built in
- **Fallback API nodes** — automatically retries on multiple Hive nodes if one fails
- **Accessibility** — keyboard focus styles, reduced motion support, screen reader friendly

---

## How It Works

When someone visits your site:

1. Their browser loads your HTML/CSS/JS files from your host
2. `app.js` calls the Hive public API directly from the browser
3. If the primary API node fails, it automatically retries on backup nodes
4. Your posts are fetched, sanitized, and rendered in real time
5. No data ever touches your server — it goes straight from Hive to your visitor

Your posts are **never copied or stored** by this script. They always come fresh from the blockchain.

---

## Security

SoloHive uses **DOMPurify** to sanitize all post and comment content before rendering.
This prevents malicious Hive posts from injecting scripts that could harm your visitors.
If DOMPurify fails to load for any reason, content rendering is blocked entirely rather
than displaying potentially unsafe content.

The `analyticsCode` slot in `config.js` accepts arbitrary script tags — only paste code
from providers you fully trust.

---

## FAQ

**Do I need coding knowledge?**
If you can edit a text file and upload files to a web host, you're good.
The only file you need to edit is `config.js`.

**Will this affect my Hive account or reputation?**
No. This script only reads from Hive. It never writes anything to the blockchain.

**Can I still earn Hive rewards?**
Yes. Your posts earn curation rewards normally through Hive. This site is completely separate.

**Can I run ads?**
Yes — paste your ad code into the widget slots in `config.js`. Since the ads are on your
website (not inside the Hive post), there is nothing for anyone on Hive to downvote.

**Can I show posts from a Hive community?**
Yes — set `hiveCommunity: "hive-123456"` in `config.js`.
Posts from all authors in that community will appear.

**Can I show only posts with a specific tag?**
Yes — set `defaultTag: "photography"` (or any tag) in `config.js`.

**Can I choose which Hive frontend links point to?**
Yes — set `hiveFrontend: "peakd.com"` (or any frontend) in `config.js`.
All @mention links, #hashtag links, author profiles, and "View on Hive" links
will point to your chosen frontend.

**What if Hive's API is down?**
SoloHive automatically tries several backup API nodes before showing an error.
Your posts are always safe on the blockchain — they never go away.

**Can I use a custom domain?**
Yes — that's the whole point. Point your domain at your host and upload the files.
Works with any domain registrar.

**Does it work on free hosting?**
Yes. Any host that serves static HTML files works.
No PHP, Node.js, or databases required.

**What about JavaScript being disabled?**
Visitors with JavaScript disabled will see a message explaining that JavaScript
is required to load content from the Hive blockchain.

---

## Files

| File | Purpose | Should I edit it? |
|------|---------|----------|
| `config.js` | All your settings | ✅ Yes — start here |
| `style.css` | Visual design | ✅ Optional — tweak CSS variables to match your brand |
| `index.html` | Post list page | ⚠️ Update Open Graph tags to match your site |
| `post.html` | Single post page | ⚠️ Update Open Graph tags to match your site |
| `app.js` | Hive API logic | ❌ No need to touch this |
| `favicon.svg` | Default favicon | ✅ Replace with your own image if desired |

---

## License

MIT — free to use, modify, and distribute.
