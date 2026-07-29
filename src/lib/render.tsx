#!/usr/bin/env node
import React from "react"
import { render } from "ink"
import { App } from "./app.js"

const ESC = String.fromCharCode(27)
// Enter alt screen + clear + home / leave alt screen (restores normal buffer).
const ENTER_ALT_SCREEN = `${ESC}[?1049h${ESC}[2J${ESC}[H`
const LEAVE_ALT_SCREEN = `${ESC}[?1049l`

const is_tty = Boolean(process.stdout.isTTY)

// Run full-screen in the alternate screen buffer (like less/vim). Enter before
// the first render to avoid a flash of the initial frame in the normal buffer;
// leave on exit and reprint the transcript, since the alternate buffer is
// discarded when we leave it.
if (is_tty) process.stdout.write(ENTER_ALT_SCREEN)

let transcript: string[] = []

const app = render(
  <App root={process.cwd()} onExit={(lines) => (transcript = lines)} />
)

app
  .waitUntilExit()
  .then(() => {
    if (is_tty) process.stdout.write(LEAVE_ALT_SCREEN)
    if (transcript.length > 0) {
      process.stdout.write(`\n${transcript.join("\n")}\n`)
    }
  })
  .catch(() => {
    if (is_tty) process.stdout.write(LEAVE_ALT_SCREEN)
    process.exitCode = 1
  })
