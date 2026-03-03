# Cafe Au May POS

A lightweight point-of-sale system for Cafe Au May, built with React and Supabase.

## Features

- Ring up orders with a tap-friendly menu interface
- Track sales by day with customer names and payment methods (Cash / Venmo)
- Menu management with categories (Drinks, Sweet, Savory, Add-Ons), pricing, and cost tracking
- Daily sales summaries with profit margins
- Offline-capable with localStorage, syncs to Supabase when online
- Google Sheets auto-sync for reporting (via Apps Script, runs separately)

## Tech Stack

- **Frontend**: React + Vite
- **Database**: Supabase (Postgres)
- **Hosting**: GitHub Pages

## Setup

1. Clone the repo
2. `npm install`
3. Create a `.env` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=<your-supabase-url>
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```
4. `npm run dev`
