import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, idbPersister } from './lib/queryClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: idbPersister }}>
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)
