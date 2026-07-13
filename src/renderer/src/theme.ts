import { ActionIcon, Button, createTheme, Image, Popover, Tooltip } from '@mantine/core'

const radiusSize = 'md'

export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  defaultGradient: { from: 'violet', to: 'cyan', deg: 90 },
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
  components: {
    // Without this, Image falls back to its own built-in default (no rounding)
    // rather than the app's defaultRadius, so every usage would otherwise need
    // an explicit radius="md" prop to stay consistent with the rest of the UI.
    ActionIcon: ActionIcon.extend({
      defaultProps: {
        radius: radiusSize,
        size: 'sm',
        variant: 'subtle',
        styles: {
          root: { transition: 'opacity 120ms ease' }
        }
      }
    }),
    Button: Button.extend({
      defaultProps: {
        radius: radiusSize
      }
    }),
    Image: Image.extend({
      defaultProps: {
        radius: radiusSize
      }
    }),
    Popover: Popover.extend({
      defaultProps: {
        radius: radiusSize
      }
    }),
    Tooltip: Tooltip.extend({
      defaultProps: {
        color: 'gray'
      }
    })
  }
})
