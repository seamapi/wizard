import type { BuildMode } from 'lib/steps/build-plan.js'

// One thing the judge scores 0–1 over the integration diff. Phrased as an
// assertion the judge rates how well the diff satisfies.
export interface RubricDimension {
  id: string
  question: string
}

// Dimensions every integration is judged on, plus mode-specific ones. Kept as
// plain data so the same rubric can drive an LLM judge now and a dedicated
// scorer (e.g. withpi) later.
const SHARED: RubricDimension[] = [
  {
    id: 'extends_existing',
    question:
      "Does it extend the app's existing files, flows, and pages rather than adding standalone Seam-only pages?",
  },
  {
    id: 'idiomatic',
    question:
      "Is the code idiomatic for the app's framework and conventions, and are the changes minimal?",
  },
  {
    id: 'env_key',
    question:
      'Does it read SEAM_API_KEY from the existing environment rather than hardcoding or printing a key?',
  },
]

const FULL_API: RubricDimension[] = [
  {
    id: 'access_grant_on_reservation',
    question:
      'When a reservation/booking is created, does it create an Access Grant (guest as a User Identity, scoped to the space, over the stay window) and revoke it on cancellation?',
  },
  {
    id: 'device_to_space_mapping',
    question: "Does it map connected devices onto the app's spaces/units?",
  },
  {
    id: 'surfaces_access',
    question:
      'Does it surface the resulting access (such as the PIN code) on the existing reservation view?',
  },
]

const CUSTOMER_PORTAL: RubricDimension[] = [
  {
    id: 'embedded_portal',
    question:
      'Does it create an embedded Customer Portal (is_embedded) and render the returned hosted URL in an iframe?',
  },
  {
    id: 'pushdata_sync',
    question:
      'Does it keep Seam in sync by calling customers.pushData on booking create/update and deleteData on cancellation (not only when a page is opened)?',
  },
]

export function getRubric(mode: BuildMode): RubricDimension[] {
  return [
    ...SHARED,
    ...(mode === 'customer_portal' ? CUSTOMER_PORTAL : FULL_API),
  ]
}
