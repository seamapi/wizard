import { expect, test } from 'vitest'

import { getRubric } from './rubric.js'
import { parseJudgeResponse } from './score.js'

test('getRubric: full_api includes the reservation→grant dimension', () => {
  const ids = getRubric('full_api').map((dimension) => dimension.id)
  expect(ids).toContain('access_grant_on_reservation')
  expect(ids).toContain('extends_existing')
  expect(ids).not.toContain('embedded_portal')
})

test('getRubric: customer_portal includes the portal dimensions', () => {
  const ids = getRubric('customer_portal').map((dimension) => dimension.id)
  expect(ids).toContain('embedded_portal')
  expect(ids).toContain('pushdata_sync')
  expect(ids).not.toContain('access_grant_on_reservation')
})

test('parseJudgeResponse: averages the per-dimension scores', () => {
  const rubric = getRubric('full_api')
  const scores = Object.fromEntries(rubric.map((d) => [d.id, 1]))
  const result = parseJudgeResponse(JSON.stringify(scores), rubric)
  expect(result.total).toBe(1)
  expect(Object.keys(result.dimensions)).toHaveLength(rubric.length)
})

test('parseJudgeResponse: missing dimensions score 0', () => {
  const rubric = getRubric('full_api')
  const result = parseJudgeResponse(
    JSON.stringify({ extends_existing: 1 }),
    rubric,
  )
  expect(result.dimensions['extends_existing']).toBe(1)
  expect(result.dimensions['idiomatic']).toBe(0)
  expect(result.total).toBeCloseTo(1 / rubric.length)
})

test('parseJudgeResponse: clamps out-of-range and non-numeric values', () => {
  const rubric = getRubric('full_api')
  const result = parseJudgeResponse(
    JSON.stringify({
      extends_existing: 5,
      idiomatic: -3,
      env_key: 'nope',
    }),
    rubric,
  )
  expect(result.dimensions['extends_existing']).toBe(1)
  expect(result.dimensions['idiomatic']).toBe(0)
  expect(result.dimensions['env_key']).toBe(0)
})

test('parseJudgeResponse: tolerates prose around the JSON', () => {
  const rubric = getRubric('customer_portal')
  const scores = Object.fromEntries(rubric.map((d) => [d.id, 0.5]))
  const result = parseJudgeResponse(
    `Here are the scores:\n${JSON.stringify(scores)}\nDone.`,
    rubric,
  )
  expect(result.total).toBeCloseTo(0.5)
})

test('parseJudgeResponse: unparseable text scores 0 across the board', () => {
  const rubric = getRubric('full_api')
  const result = parseJudgeResponse('the model refused', rubric)
  expect(result.total).toBe(0)
})
