import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import {
  PERMISSION_KINDS,
  isHighRisk,
  usePermissions,
  type PermissionPolicy,
} from '@/stores/permissions';

const POLICIES: readonly PermissionPolicy[] = ['ask', 'allow', 'never'];

export function PermissionsPanel(): React.ReactElement {
  const { t } = useTranslation();
  const policies = usePermissions((s) => s.policies);
  const setPolicy = usePermissions((s) => s.setPolicy);
  const resetPermissions = usePermissions((s) => s.resetPermissions);
  const relaxed = usePermissions((s) => s.hasRelaxedPolicy)();

  return (
    <div data-testid="settings-panel-permissions">
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--color-ink-soft)]">
        {t('settings.permissions.intro')}
      </p>

      <ul className="flex flex-col gap-2">
        {PERMISSION_KINDS.map((kind) => {
          const current = policies[kind];
          return (
            <li
              key={kind}
              className="flex items-center gap-2 border-b border-[var(--color-line)] pb-2 last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-xs text-[var(--color-ink)]">
                  {t(`approvals.kind.${kind}`)}
                  {isHighRisk(kind) ? (
                    <Icon
                      name="alert"
                      size={11}
                      aria-label={t('settings.permissions.highRisk')}
                      className="shrink-0 text-[var(--color-warn)]"
                    />
                  ) : null}
                </span>
                {current === 'allow' ? (
                  <span
                    data-testid={`permission-warning-${kind}`}
                    className="block text-[10px] text-[var(--color-warn)]"
                  >
                    {t('settings.permissions.allowWarning')}
                  </span>
                ) : null}
              </span>

              <div
                role="radiogroup"
                aria-label={t(`approvals.kind.${kind}`)}
                data-testid={`permission-${kind}`}
                className={cn(
                  'inline-flex shrink-0 rounded-md border p-0.5',
                  'border-[var(--color-line)] bg-[var(--color-surface-2)]',
                )}
              >
                {POLICIES.map((policy) => (
                  <button
                    key={policy}
                    type="button"
                    role="radio"
                    aria-checked={current === policy}
                    data-testid={`permission-${kind}-${policy}`}
                    onClick={() => setPolicy(kind, policy)}
                    className={cn(
                      'rounded px-2 py-0.5 text-[10px] transition',
                      current === policy
                        ? 'bg-[var(--color-surface)] font-medium text-[var(--color-ink)] shadow-sm'
                        : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]',
                    )}
                  >
                    {t(`settings.permissions.policy.${policy}`)}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center gap-2">
        {relaxed ? (
          <p
            data-testid="permissions-relaxed"
            className="text-[10px] text-[var(--color-warn)]"
          >
            {t('settings.permissions.relaxed')}
          </p>
        ) : (
          <p className="text-[10px] text-[var(--color-ink-soft)]">
            {t('settings.permissions.allSafe')}
          </p>
        )}
        <button
          type="button"
          data-testid="permissions-reset"
          onClick={() => resetPermissions()}
          className={cn(
            'ms-auto rounded-md border border-[var(--color-line)] px-2.5 py-1',
            'text-xs hover:border-[var(--color-brand)]',
          )}
        >
          {t('settings.permissions.reset')}
        </button>
      </div>
    </div>
  );
}
