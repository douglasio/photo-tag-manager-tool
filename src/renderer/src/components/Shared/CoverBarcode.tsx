import { Box, Text } from '@mantine/core'
import type { ReactElement } from 'react'

// A repeating-gradient barcode — the corner decoration nearly every
// magazine/DVD cover carries — purely decorative, no real data encoded.
// Shared across the PhotoView cover visualizations (magazine, DVD, ...).
export function CoverBarcode(): ReactElement {
  return (
    <Box bg="white" p={4} style={{ display: 'inline-block' }}>
      <Box
        w={44}
        h={26}
        style={{
          background:
            'repeating-linear-gradient(90deg, #000 0, #000 2px, #fff 2px, #fff 3px, #000 3px, #000 4px, #fff 4px, #fff 6px)'
        }}
      />
      <Text
        c="black"
        fz={8}
        ta="center"
        style={{ fontFamily: "'Courier New', monospace", letterSpacing: 1 }}
      >
        01
      </Text>
    </Box>
  )
}
