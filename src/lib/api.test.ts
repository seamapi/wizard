import { beforeEach, expect, test, vi } from 'vitest'

const { get, post } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@seamapi/http', () => ({
  isSeamHttpApiError: () => false,
  isSeamHttpUnauthorizedError: () => false,
  SeamHttpInvalidTokenError: class extends Error {},
  SeamHttpWorkspaces: class {
    get = get
    client = { post }
  },
}))

import { exchangeWizardInferenceToken, getWorkspaceForApiKey } from './api.js'

beforeEach(() => vi.clearAllMocks())

test('uses the workspace SDK and its raw client', async () => {
  const workspace = {
    workspace_id: 'workspace-1',
    name: 'Test',
    is_sandbox: true,
  }
  const onboarding = {
    org_type: 'startup',
    primary_goal: null,
    use_case: null,
    build_target: null,
    embed_customer_portal: null,
    device_categories: ['locks'],
  }
  get.mockResolvedValue(workspace)
  post.mockResolvedValue({
    data: {
      wizard_session: { token: 'token', expires_at: 'tomorrow', onboarding },
    },
  })

  await expect(getWorkspaceForApiKey('seam_key')).resolves.toBe(workspace)
  await expect(exchangeWizardInferenceToken('seam_key')).resolves.toEqual({
    token: 'token',
    expires_at: 'tomorrow',
    onboarding,
  })
  expect(post).toHaveBeenCalledWith('/seam/wizard/v1/session', {})
})
