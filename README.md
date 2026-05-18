# ApexGold AI

Vite React SPA deployment setup.

## Build settings

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install` or `bun install`

## Environment variables

Set these on Vercel, Netlify, or Cloudflare Pages:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `LOVABLE_API_KEY` (required for AI chat and chart analysis)

## Notes

The app is now a standard Vite SPA. Deep links are handled by the included Vercel, Netlify, and Cloudflare Pages fallback config.
