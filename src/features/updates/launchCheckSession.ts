// src/features/updates/launchCheckSession.ts

/** The launch-time update check runs at most once per app session; a reload starts a new session. */
let checked = false;

export const hasCheckedForUpdate = (): boolean => checked;
export const markCheckedForUpdate = (): void => {
  checked = true;
};
export const resetUpdateLaunchCheck = (): void => {
  checked = false;
};
