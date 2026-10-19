// src/features/backup/toastSession.ts

/** The backup reminder toast is shown at most once per app session; a page reload starts a new session. */
let shown = false;

export const hasShownBackupToast = (): boolean => shown;
export const markBackupToastShown = (): void => {
  shown = true;
};
export const resetBackupToastSession = (): void => {
  shown = false;
};
