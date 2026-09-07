import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Force a single copy of React to prevent hook errors from packages
    // that bundle their own React (e.g. @supabase/auth-ui-react)
    dedupe: ['react', 'react-dom'],
  },
})
