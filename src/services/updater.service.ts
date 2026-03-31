import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateProgress {
  downloaded: number;
  total: number;
  percent: number;
}

export interface UpdateInfo {
  version: string;
  notes: string | null;
}

export async function checkForUpdate(): Promise<Update | null> {
  return await check();
}

export async function downloadAndApply(
  update: Update,
  onProgress: (progress: UpdateProgress) => void,
): Promise<void> {
  let downloaded = 0;
  let total = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? 0;
        onProgress({ downloaded: 0, total, percent: 0 });
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        onProgress({ downloaded, total, percent });
        break;
      case 'Finished':
        onProgress({ downloaded: total, total, percent: 100 });
        break;
    }
  });

  await relaunch();
}
