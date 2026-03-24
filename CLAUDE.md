# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Workers application (`xvc-worker`) that provides YouTube subtitle extraction and AI-powered content analysis using DeepSeek API. The project includes both a worker backend and a React frontend.

## Development Commands

### Root Project (Worker)
- `npm run dev` - Start local development server (http://localhost:8787)
- `npm run deploy` - Deploy worker to Cloudflare
- `npm run test` - Run tests with Vitest
- `npm run cf-typegen` - Generate type definitions for Env bindings

### Web Project (Frontend)
- `npm run dev` - Start Vite dev server (web/)
- `npm run build` - Build React app to `public/` directory
- `npm run preview` - Preview production build

## Architecture

This is a monorepo with two parts:

**Root (`/`)** - Cloudflare Worker backend
- `src/index.ts` - Worker entry point with request routing
- `src/controllers/` - Request handlers
  - `youtube.ts` - YouTube subtitle endpoint (`/subtitles`)
  - `stream.ts` - DeepSeek streaming endpoint (`/deepseek`)
- `src/services/` - External API integrations
  - `youtube.ts` - Fetches subtitles from external service
  - `deepseek.ts` - Streams AI analysis from DeepSeek API
- `src/types/` - TypeScript type definitions

**Web (`/web/`)** - React frontend built with Vite
- Builds to `public/` and served by the Worker via `wrangler.jsonc` assets configuration

## API Endpoints

- `GET /subtitles?url=<youtube_url>` - Extract video ID and return subtitles as JSON
- `POST /deepseek` - Accept `{ prompt: string }`, stream AI response

## Environment Variables

Configure in `wrangler.jsonc` or via Cloudflare dashboard:
- `DEEPSEEK_API_KEY` - Required for `/deepseek` endpoint

## Testing

Tests use `@cloudflare/vitest-pool-workers`. Example test patterns:
- Unit style: `worker.fetch(request, env, ctx)` with `createExecutionContext()`
- Integration style: `SELF.fetch(request)` for end-to-end testing

Run single test: `npm run test -- -t "test name"`

## Type Safety

After adding bindings to `wrangler.jsonc`, run `npm run cf-typegen` to regenerate `worker-configuration.d.ts` for the `Env` type.
