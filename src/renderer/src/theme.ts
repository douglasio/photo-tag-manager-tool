import {
  ActionIcon,
  Blockquote,
  Button,
  createTheme,
  Group,
  Image,
  Popover,
  Switch,
  Tabs,
  Tooltip
} from '@mantine/core'

export const RADIUS_SIZE = 'md'

export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  defaultGradient: { from: 'violet', to: 'cyan', deg: 90 },
  // colors: {
  //   indigo: [...rest, '#2c3052', '#2e3156', '#252846']
  // },
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
  // Merges with (doesn't replace) Mantine's default xs/sm/md/lg/xl scale, so
  // this is available anywhere as var(--mantine-shadow-elevated) or
  // shadow="elevated" on components like Paper/Card/Menu, alongside the
  // built-in sizes.
  shadows: {
    elevated: '0 2rem 2rem rgba(0, 0, 0, 0.45)'
  },
  components: {
    // Without this, Image falls back to its own built-in default (no rounding)
    // rather than the app's defaultRadius, so every usage would otherwise need
    // an explicit radius="md" prop to stay consistent with the rest of the UI.
    ActionIcon: ActionIcon.extend({
      defaultProps: {
        radius: RADIUS_SIZE,
        size: 'md',
        variant: 'subtle',
        styles: {
          root: { transition: 'opacity 120ms ease' }
        }
      }
    }),
    Blockquote: Blockquote.extend({
      defaultProps: {
        radius: RADIUS_SIZE
      }
    }),
    Button: Button.extend({
      defaultProps: {
        radius: RADIUS_SIZE
      }
    }),
    Group: Group.extend({
      defaultProps: {
        bdrs: RADIUS_SIZE
      }
    }),
    Image: Image.extend({
      defaultProps: {
        radius: RADIUS_SIZE
      }
    }),
    Popover: Popover.extend({
      defaultProps: {
        radius: RADIUS_SIZE
      }
    }),
    Switch: Switch.extend({
      defaultProps: {
        style: { cursor: 'pointer' }
      }
    }),
    Tooltip: Tooltip.extend({
      defaultProps: {
        color: 'gray'
      }
    }),
    // Tabs default to the app's rounded defaultRadius on the tab buttons,
    // which looks wrong for the Photo View tab bar — keep tabs square.
    Tabs: Tabs.extend({
      defaultProps: {
        radius: 0
      }
    })
  }
})
