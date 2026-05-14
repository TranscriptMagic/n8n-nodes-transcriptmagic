# n8n-nodes-transcriptmagic

n8n community node for **[TranscriptMagic](https://transcriptmagic.com)** — fetch transcripts from YouTube, TikTok, Instagram, and Facebook videos directly inside your n8n workflows.

## Install

```bash
npm install n8n-nodes-transcriptmagic
```

Restart n8n. The node appears under **TranscriptMagic** in the picker.

## Setup

1. [Create an API key](https://transcriptmagic.com/dashboard/api-keys/) in the TranscriptMagic dashboard. Keys begin with `sk_live_`.
2. In n8n, add a new **TranscriptMagic API** credential and paste your key. The credential test validates the key without consuming a credit.

## Operations

### Transcript

POST a video URL, get back the transcript.

| Operation | Endpoint |
| --- | --- |
| YouTube | `POST /api/youtube/transcript` |
| TikTok | `POST /api/tiktok/transcript` |
| Instagram | `POST /api/instagram/transcript` |
| Facebook | `POST /api/facebook/transcript` |

### Account

| Operation | Endpoint |
| --- | --- |
| Get Credit Balance | `GET /api/balance` |

## Output formats

The node exposes two output modes via **Options → Output Format**:

- **Normalized** (default) — `{ text, platform, credits, url }`. Hides per-platform shape differences so the same downstream nodes work across YouTube, TikTok, Instagram, and Facebook.
- **Raw** — the upstream API response passed through verbatim. Use this when you need YouTube's per-line timed segments or platform-specific metadata (`videoUrls`, `language`, etc).

## Error handling

- **Continue on fail** is supported. A bad URL in a batch surfaces as a per-item error, and the rest of the batch keeps running.
- **Rate limits**: when the API returns `429`, the node honors `Retry-After` and retries once. The per-key limit is 120 requests/minute.

## Example workflows

A ready-to-import quickstart workflow lives in [`examples/quickstart.json`](examples/quickstart.json). Below are common patterns to copy.

### 1. Single-URL transcription

The minimal flow: trigger → transcribe → done.

1. **Manual Trigger**
2. **TranscriptMagic**
   - Resource: `Transcript`
   - Operation: `YouTube` (or TikTok / Instagram / Facebook)
   - URL: paste any public video URL
3. Run. The output item contains `text`, `platform`, `credits`, and `url`.

### 2. Batch transcription with graceful failures

Process many URLs at once. Bad URLs surface as per-item errors without aborting the batch, and the node honors `Retry-After` on 429 automatically.

1. **Google Sheets** / **Airtable** / **Set** node returning multiple items, each with a `url` field.
2. **TranscriptMagic** node:
   - URL: `={{ $json.url }}`
   - **Settings → On Error**: Continue
3. Downstream **Google Sheets** (or any destination) to write transcripts back, keyed off the original `url` from the paired item.

### 3. Transcript → AI summary → notification

The classic insight-extraction pattern.

1. **Schedule Trigger** (or **Webhook**, **RSS Feed**, **Telegram**, etc.)
2. **TranscriptMagic** → fetch transcript
3. **OpenAI** / **Anthropic** node — prompt with `={{ $json.text }}`
4. **Slack** / **Email** / **Notion** → deliver the summary

### 4. Pre-flight balance check

Before kicking off a big batch, verify you have credits left:

1. **TranscriptMagic** — Resource: `Account`, Operation: `Get Credit Balance`
2. **IF** — `={{ $json.credits >= 1000 }}` → continue, else send an alert

This call does not consume a credit.

## Links

- [API documentation](https://docs.transcriptmagic.com)
- [TranscriptMagic homepage](https://transcriptmagic.com)
- [Report an issue](https://github.com/TranscriptMagic/n8n-nodes-transcriptmagic/issues)

## License

[MIT](LICENSE)
