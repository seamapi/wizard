#!/usr/bin/env tsx

import landlubber from 'landlubber'

import * as wizard from './wizard.js'

const commands = [wizard]

await landlubber(commands).parse()
