import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // better-sqlite3 is a native addon; keep it out of the server bundle so Next
  // loads it from node_modules at runtime instead of trying to bundle the .node.
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
