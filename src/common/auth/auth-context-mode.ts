type AuthContextMode = 'default' | 'validation';
export type ValidationWorkspaceKey = 'snackit' | 'perfect-fabric';

type ConfiguredAuthUserSelector = {
  userId: string | null;
  email: string | null;
  requireExplicitSelection: boolean;
};

const validationWorkspaceEnvMap: Record<
  ValidationWorkspaceKey,
  { userIdEnv: string; emailEnv: string }
> = {
  snackit: {
    userIdEnv: 'VALIDATION_WORKSPACE_SNACKIT_USER_ID',
    emailEnv: 'VALIDATION_WORKSPACE_SNACKIT_EMAIL',
  },
  'perfect-fabric': {
    userIdEnv: 'VALIDATION_WORKSPACE_PERFECT_FABRIC_USER_ID',
    emailEnv: 'VALIDATION_WORKSPACE_PERFECT_FABRIC_EMAIL',
  },
};

function normalizeEnvValue(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeOptionalValue(value: string | undefined): string | null {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

export function normalizeValidationWorkspaceKey(
  value: string | string[] | null | undefined,
): ValidationWorkspaceKey | null {
  const normalizedValue = Array.isArray(value)
    ? normalizeEnvValue(value[0])
    : normalizeEnvValue(value ?? undefined);

  if (!normalizedValue) {
    return null;
  }

  if (['snackit', 'food', 'food-operations'].includes(normalizedValue)) {
    return 'snackit';
  }

  if (
    [
      'perfect-fabric',
      'perfect_fabric',
      'perfect fabric',
      'fashion',
      'fashion-operations',
    ].includes(normalizedValue)
  ) {
    return 'perfect-fabric';
  }

  return null;
}

export function getAuthContextMode(): AuthContextMode {
  return normalizeEnvValue(process.env.AUTH_CONTEXT_MODE) === 'validation'
    ? 'validation'
    : 'default';
}

export function getConfiguredAuthUserSelector(): ConfiguredAuthUserSelector {
  if (getAuthContextMode() === 'validation') {
    return {
      userId: normalizeOptionalValue(process.env.VALIDATION_AUTH_USER_ID),
      email: normalizeOptionalValue(process.env.VALIDATION_AUTH_EMAIL),
      requireExplicitSelection: true,
    };
  }

  return {
    userId: normalizeOptionalValue(process.env.DEFAULT_AUTH_USER_ID),
    email: normalizeOptionalValue(process.env.DEFAULT_AUTH_EMAIL),
    requireExplicitSelection: false,
  };
}

export function getValidationWorkspaceAuthUserSelector(
  workspaceKey: ValidationWorkspaceKey,
): ConfiguredAuthUserSelector {
  const envMap = validationWorkspaceEnvMap[workspaceKey];

  return {
    userId: normalizeOptionalValue(process.env[envMap.userIdEnv]),
    email: normalizeOptionalValue(process.env[envMap.emailEnv]),
    requireExplicitSelection: true,
  };
}
