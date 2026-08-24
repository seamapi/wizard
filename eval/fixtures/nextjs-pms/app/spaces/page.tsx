import { listSpaces } from '@/lib/queries'

import { SpacesClient } from './spaces-client'

export const dynamic = 'force-dynamic'

export default async function SpacesPage() {
  const spaces = await listSpaces()
  return <SpacesClient spaces={spaces} />
}
