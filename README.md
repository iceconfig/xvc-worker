# XVC Worker

A Cloudflare Workers application that extracts YouTube video subtitles and generates in-depth analysis using AI (DeepSeek).

## Features

- 🎬 YouTube subtitle extraction from any video
- 🤖 AI-powered content analysis using DeepSeek API
- ⚡ Serverless deployment on Cloudflare Workers
- 🖥️ Simple React web interface
- 📡 Streaming responses for real-time output

## Project Structure

```
xvc-worker/
├── src/
│   ├── index.ts              # Worker entry point & routing
│   ├── controllers/
│   │   ├── youtube.ts        # Subtitle request handler
│   │   └── stream.ts         # DeepSeek streaming handler
│   ├── services/
│   │   ├── youtube.ts        # YouTube subtitle fetcher
│   │   └── deepseek.ts       # DeepSeek API integration
│   └── types/
│       └── llm.ts            # TypeScript type definitions
├── web/                      # React frontend (Vite)
│   ├── src/
│   │   ├── App.tsx           # Main application component
│   │   └── main.tsx          # React entry point
│   └── index.html
├── test/                     # Vitest test files
├── wrangler.jsonc            # Worker configuration
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Cloudflare account (for deployment)
- DeepSeek API key

### Installation

```bash
# Install root dependencies
npm install

# Install web dependencies
cd web && npm install
```

### Development

1. **Start the Worker:**
   ```bash
   npm run dev
   ```
   The worker will be available at http://localhost:8787

2. **Build and serve the frontend:**
   ```bash
   cd web
   npm run build
   ```
   This builds the React app to the `public/` directory, which is automatically served by the Worker.

### Environment Variables

Create a `.dev.vars` file in the root directory:

```
DEEPSEEK_API_KEY=your_deepseek_api_key
```

For production, configure secrets via Wrangler CLI:

```bash
npx wrangler secret put DEEPSEEK_API_KEY
```

## API Endpoints

### GET /subtitles

Extract subtitles from a YouTube video.

**Query Parameters:**
- `url` (required): YouTube video URL

**Example:**
```bash
curl "http://localhost:8787/subtitles?url=https://www.youtube.com/watch?v=VIDEO_ID"
```

**Response:**
```json
{
  "videoId": "VIDEO_ID",
  "language": "en",
  "subtitles": [
    { "start": 0, "duration": 3.5, "text": "Hello, welcome to..." },
    { "start": 3.5, "duration": 2.0, "text": "Today we will discuss..." }
  ]
}
```

### POST /deepseek

Stream AI-generated analysis from subtitles.

**Request Body:**
```json
{
  "prompt": "Your subtitle text or analysis prompt"
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/deepseek \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Analyze this content..."}'
```

**Response:** Streaming text/plain response

## Deployment

```bash
# Build the frontend first
cd web && npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

## Testing

```bash
# Run all tests
npm run test

# Run specific test
npm run test -- -t "test name"
```

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Frontend:** React 19, Vite
- **Language:** TypeScript
- **Testing:** Vitest with @cloudflare/vitest-pool-workers
- **AI:** DeepSeek API

## License

MIT
