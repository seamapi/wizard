import { createServer, type ServerResponse } from "node:http"
import { randomBytes } from "node:crypto"
import { join } from "node:path"
import open from "open"
import { getWorkspaceForApiKey, type SeamWorkspace } from "../util/seam-api.js"
import { upsertEnvVar } from "../util/env-file.js"

// The dashboard "wizard" page mints a key and posts it back to the local
// callback. Override the console host with SEAM_CONSOLE_URL for dev.
const CONSOLE_URL = process.env.SEAM_CONSOLE_URL ?? "https://console.seam.co"
const CONSOLE_WIZARD_PATH = "/dashboard/wizard"
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000

export interface WebConnectResult {
  workspace: SeamWorkspace
}

// Progress callbacks so the Ink UI can render the handoff without any logging
// living in this module.
export interface WebConnectEvents {
  onUrl?: (url: string) => void
  onWaiting?: () => void
  onReceived?: () => void
}

interface CallbackPayload {
  state: string
  api_key: string
}

// Browser → CLI handoff: start a localhost callback, open the dashboard wizard
// with the port + a random state, and wait for the page to post the freshly
// created key back. Throws on error/timeout; resolves with the workspace.
//
// Wire protocol (must match the dashboard page): the page is opened at
//   {CONSOLE_URL}/dashboard/wizard?cli_connect=1&cli_port=<PORT>&cli_state=<STATE>
// and POSTs JSON { state, api_key } to http://127.0.0.1:<PORT>/ (CORS *).
export async function connectViaWeb(
  root: string,
  events: WebConnectEvents = {}
): Promise<WebConnectResult> {
  const state = randomBytes(16).toString("hex")

  const payload = await new Promise<CallbackPayload>((resolve, reject) => {
    const server = createServer((request, response) => {
      response.setHeader("Access-Control-Allow-Origin", "*")
      response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
      response.setHeader("Access-Control-Allow-Headers", "content-type")

      if (request.method === "OPTIONS") {
        response.writeHead(204)
        response.end()
        return
      }
      if (request.method !== "POST") {
        response.writeHead(405)
        response.end()
        return
      }

      let body = ""
      request.on("data", (chunk) => {
        body += chunk
      })
      request.on("end", () => {
        let parsed: Partial<CallbackPayload> = {}
        try {
          parsed = JSON.parse(body) as Partial<CallbackPayload>
        } catch {
          respondJson(response, 400, { ok: false, error: "invalid_json" })
          return
        }
        if (parsed.state !== state) {
          respondJson(response, 403, { ok: false, error: "state_mismatch" })
          return
        }
        if (parsed.api_key == null || parsed.api_key.length === 0) {
          respondJson(response, 400, { ok: false, error: "missing_api_key" })
          return
        }
        respondJson(response, 200, { ok: true })
        events.onReceived?.()
        server.close()
        resolve({ state, api_key: parsed.api_key })
      })
    })

    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (address == null || typeof address === "string") {
        reject(new Error("Could not start the local callback server."))
        return
      }
      const url = `${CONSOLE_URL}${CONSOLE_WIZARD_PATH}?cli_connect=1&cli_port=${address.port}&cli_state=${state}`
      events.onUrl?.(url)
      void open(url).catch(() => {
        // Browser may not open (headless/SSH) — the UI shows the URL to visit.
      })
      events.onWaiting?.()
    })

    const timeout = setTimeout(() => {
      server.close()
      reject(new Error("Timed out waiting for the browser."))
    }, CALLBACK_TIMEOUT_MS)
    timeout.unref()
  })

  const workspace = await getWorkspaceForApiKey(payload.api_key)
  upsertEnvVar(join(root, ".env"), "SEAM_API_KEY", payload.api_key)
  return { workspace }
}

function respondJson(
  response: ServerResponse,
  status: number,
  body: unknown
): void {
  response.writeHead(status, { "content-type": "application/json" })
  response.end(JSON.stringify(body))
}
