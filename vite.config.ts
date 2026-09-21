import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vercel serves the site from the domain root; GitHub Pages serves it under /stock-ledger-lab/.
// Vercel sets VERCEL=1 during its builds.
const base = process.env.VERCEL ? '/' : '/stock-ledger-lab/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
