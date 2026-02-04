# Scratch: AI-powered editor for marketers

**An online tool for viewing, editing, and publishing content across marketing channels with AI assistance**

---

## Problem

Founders and marketing teams work with content across multiple services—their website (Webflow, WordPress, SSG, etc.), their YouTube channel, their product documentation (GitBook, Mintlify), their e-commerce store (Shopify), their internal documents, etc. Historically, it's been difficult to manage large content libraries for a business and keep everything:

- Accurate
- Fresh
- High quality
- SEO optimized

AI agents have drastically lowered the cost of bulk content housekeeping, but marketers haven't had good tools to make use of them.

## Solution

Scratch is an AI-powered content editor that creates isolated local workspaces (called "snapshots") where you can safely pull data from external services, edit it with AI assistance, and publish changes back when you're ready.

---

## Who it's for

**Founders and content marketing teams** with large content libraries across multiple platforms.

---

## Key features

### Workbenches

Create isolated environments with snapshots to work with data from multiple sources simultaneously. All changes stay local until you're ready to publish.

### Connectors

Pull data from Airtable, Notion, WordPress, Webflow, Wix, YouTube, PostgreSQL, CSV files, and more.

### AI-powered editing

Chat with an AI agent to transform your data:

- Bulk updates and search-replace operations
- Add/modify columns and data structures
- Upload and import external content
- Get intelligent suggestions for improvements

### Exports and imports

Download data, make changes locally, then publish back to the original source. Import CSV files and Markdown documents (with front matter) to create new snapshots or enrich existing data.

---

## How it works

1. **Connect** - Authenticate with your data sources via OAuth or API keys
2. **Snapshot** - Create a workbench and pull in tables of content from any data source
3. **Edit** - View and modify data in Scratch with SQL queries, UI tools, or AI assistance
4. **Publish** - Push changes back to the original services when ready

All data is stored in isolated PostgreSQL schemas.

---

## Technical highlights

- **Modern Stack**: Next.js 15, NestJS
- **AI Integration**: OpenRouter for multi-LLM access (Claude, GPT, etc.)
- **Real-Time**: WebSocket gateway + Redis pub/sub for live updates
- **Scalable**: Microservice-ready architecture (frontend, worker, cron services)
- **Secure**: Clerk authentication, encrypted credentials, SOC 2 and GDPR-compliant
- **Production-Ready**: Deployed on GCP

---

## Production URLs

- **Client**: https://app.scratch.md/
- **API**: https://api.scratch.md/

---

## Use cases

- **Content enrichment**: add relevant links and FAQ sections to blog posts, or chapter markers to YouTube videos
- SEO improvements: fix issues on your site like broken links and images, missing image alt text, HTTP/HTTPS mismatches, or missing tags
- **Content housekeeping**: make bulk updates to evergreen content as company and product information changes

**Think Cursor + Git for your marketing content.**
