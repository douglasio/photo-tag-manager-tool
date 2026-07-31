import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'
import '@fontsource/bebas-neue'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/playfair-display/900.css'
import '@fontsource/anton'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

import App from './App'
import { theme } from './theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="bottom-right" autoClose={6000} />
      <App />
    </MantineProvider>
  </StrictMode>
)
