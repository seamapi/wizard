import { render } from 'ink'

import { App } from './app.js'
import { DebugScreen } from './screens/debug-screen.js'

const ESC = String.fromCharCode(27)
// Enter alt screen + clear + home / leave alt screen (restores normal buffer).
const ENTER_ALT_SCREEN = `${ESC}[?1049h${ESC}[2J${ESC}[H`
const LEAVE_ALT_SCREEN = `${ESC}[?1049l`

export interface RenderAppOptions {
  /** The project root the wizard sets up. */
  root: string
}

/**
 * Render the wizard full-screen and resolve once the user has finished.
 *
 * The app runs in the alternate screen buffer (like less or vim). Entering it
 * before the first render avoids a flash of the initial frame in the normal
 * buffer. The alternate buffer is discarded on the way out, so the transcript
 * the app hands back is reprinted afterwards, leaving the usual record of the
 * run behind in the terminal's scrollback.
 *
 * Rejects if the app fails to run, leaving the terminal restored either way.
 */
export const renderApp = async ({ root }: RenderAppOptions): Promise<void> => {
  const isTty = Boolean(process.stdout.isTTY)
  if (isTty) process.stdout.write(ENTER_ALT_SCREEN)

  let transcript: readonly string[] = []

  const app = render(
    <App
      root={root}
      onExit={(lines) => {
        transcript = lines
      }}
    />,
  )

  try {
    await app.waitUntilExit()
  } finally {
    if (isTty) process.stdout.write(LEAVE_ALT_SCREEN)
    if (transcript.length > 0) {
      process.stdout.write(`\n${transcript.join('\n')}\n`)
    }
  }
}

/**
 * Render a single named screen full-screen for previewing its layout, without
 * running the wizard's auth/agent flow. Omit `name` (or pass an unknown one) to
 * get a chooser of every screen. Exits on q / Esc.
 */
export const renderDebugScreen = async (name?: string): Promise<void> => {
  const isTty = Boolean(process.stdout.isTTY)
  if (isTty) process.stdout.write(ENTER_ALT_SCREEN)

  const app = render(
    name != null ? <DebugScreen name={name} /> : <DebugScreen />,
  )

  try {
    await app.waitUntilExit()
  } finally {
    if (isTty) process.stdout.write(LEAVE_ALT_SCREEN)
  }
}
