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

## Links

- [API documentation](https://docs.transcriptmagic.com)
- [TranscriptMagic homepage](https://transcriptmagic.com)
- [Report an issue](https://github.com/TranscriptMagic/n8n-nodes-transcriptmagic/issues)

## License

[MIT](LICENSE)
