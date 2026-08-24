import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import express from 'express'

import { SPACE_KIND_LABELS } from './space-kinds.js'
import { bookingsRouter } from './routes/bookings.js'
import { reservationsRouter } from './routes/reservations.js'
import { spacesRouter } from './routes/spaces.js'

// Importing db.js runs the schema bootstrap, so the tables exist before the
// first request.
import './db.js'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))

const app = express()

app.set('view engine', 'ejs')
app.set('views', join(rootDir, 'views'))
// Make the space-kind labels available to every view.
app.locals.SPACE_KIND_LABELS = SPACE_KIND_LABELS

app.use(express.urlencoded({ extended: true }))

app.use(bookingsRouter)
app.use(reservationsRouter)
app.use(spacesRouter)

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Express PMS listening on http://localhost:${port}`)
})
