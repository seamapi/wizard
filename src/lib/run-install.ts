import { spawn } from 'node:child_process'

// Run a command with piped output, streaming each non-empty line to `onLine`
// so the Ink UI can render progress instead of clobbering the frame with
// inherited stdio.
export function runInstall(
  command: string[],
  cwd: string,
  onLine: (line: string) => void,
): Promise<void> {
  const [binary, ...args] = command
  if (binary == null) throw new Error('runInstall: empty command')

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })

    const handle = (data: Buffer): void => {
      for (const line of data.toString().split('\n')) {
        if (line.trim().length > 0) onLine(line.trimEnd())
      }
    }
    child.stdout?.on('data', handle)
    child.stderr?.on('data', handle)

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${binary} exited with code ${code ?? 'unknown'}`))
    })
  })
}
