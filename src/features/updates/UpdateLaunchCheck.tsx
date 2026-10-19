// src/features/updates/UpdateLaunchCheck.tsx

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { checkForUpdate, isUpdaterEnabled } from '@/core/services/updater/updater.service';
import { hasCheckedForUpdate, markCheckedForUpdate } from './launchCheckSession';

/**
 * Checks for an update once per app session and only tells the user about it. Installing always
 * goes through the explicit flow in `UpdateSettings`. Failures are silent: being offline at launch
 * is normal and not worth interrupting anyone for. Renders nothing.
 */
export default function UpdateLaunchCheck() {
  const navigate = useNavigate();

  useEffect(() => {
    if (hasCheckedForUpdate() || !isUpdaterEnabled()) return;
    markCheckedForUpdate();

    void checkForUpdate()
      .then((update) => {
        if (!update) return;
        toast.info(`Sparktype ${update.version} is available`, {
          duration: 15_000,
          action: {
            label: 'View update',
            onClick: () => {
              navigate('/');
              // The dashboard may not be mounted yet when navigating from another page.
              setTimeout(() => document.getElementById('app-updates')?.scrollIntoView?.({ behavior: 'smooth' }), 100);
            },
          },
        });
      })
      .catch((error) => console.warn('Update check failed:', error));
  }, [navigate]);

  return null;
}
