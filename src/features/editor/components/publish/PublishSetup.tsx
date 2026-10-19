// src/features/editor/components/publish/PublishSetup.tsx

import { useState } from 'react';
import { Download, Github, Globe } from 'lucide-react';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { testProviderConnection } from '@/core/services/publishing/connectionTest';
import type { LocalSiteData } from '@/core/types';
import { GitHubFields, NetlifyFields } from '@/pages/sites/settings/publishing/ProviderFields';
import {
  buildPublishingConfig,
  buildPublishingSecrets,
  defaultGitHubConfig,
  defaultNetlifyConfig,
  type PublishingProvider,
} from '@/pages/sites/settings/publishing/providerConfig';

interface PublishSetupProps {
  site: LocalSiteData;
  onComplete: () => void;
}

const CHOICES: { value: PublishingProvider; label: string; icon: typeof Download }[] = [
  { value: 'zip', label: 'Export as ZIP', icon: Download },
  { value: 'netlify', label: 'Deploy to Netlify', icon: Globe },
  { value: 'github', label: 'Deploy to GitHub', icon: Github },
];

/**
 * First-run setup, shown when a site has no publishing provider. It reuses the settings page's
 * fields and save helpers, so credentials land in the same secrets store and the same manifest
 * keys. The provider is only written to the manifest once its connection test passes; secrets are
 * written first because Netlify's validation reads the proxy settings back from storage.
 */
export default function PublishSetup({ site, onComplete }: PublishSetupProps) {
  const updateManifest = useAppStore((state) => state.updateManifest);
  const updateSiteSecrets = useAppStore((state) => state.updateSiteSecrets);
  const [provider, setProvider] = useState<PublishingProvider>('zip');
  const [netlify, setNetlify] = useState(defaultNetlifyConfig);
  const [github, setGithub] = useState(defaultGitHubConfig);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  // Set once the provider is saved and there are notes to read before moving on.
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErrors([]);
    setNotes([]);
    try {
      let resultNotes: string[] = [];
      if (provider !== 'zip') {
        const secrets = buildPublishingSecrets(site, provider, netlify, github);
        if (secrets) await updateSiteSecrets(site.siteId, secrets);

        const config =
          provider === 'github'
            ? { accessToken: github.accessToken, owner: github.owner, repo: github.repo, branch: github.branch }
            : { apiToken: netlify.apiToken, siteId: netlify.siteId, siteName: netlify.siteName };
        const result = await testProviderConnection(provider, config, site.siteId);
        if (!result.ok) {
          setErrors(result.errors);
          return;
        }
        resultNotes = result.notes;
      }

      await updateManifest(site.siteId, {
        ...site.manifest,
        publishingConfig: buildPublishingConfig(provider, netlify, github),
      });

      // Notes (e.g. "the branch will be created") are only worth reading if they hold the flow up.
      if (resultNotes.length > 0) {
        setNotes(resultNotes);
        setSaved(true);
      } else {
        onComplete();
      }
    } catch (error) {
      setErrors([`Setup could not be saved: ${(error as Error).message}`]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-h-[60vh] space-y-4 overflow-y-auto">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Where do you want to publish?</legend>
        {CHOICES.map(({ value, label, icon: Icon }) => (
          <Label key={value} className="flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal">
            <input
              type="radio"
              name="publish-provider"
              value={value}
              checked={provider === value}
              onChange={() => setProvider(value)}
            />
            <Icon aria-hidden className="h-4 w-4" />
            {label}
          </Label>
        ))}
      </fieldset>

      {provider === 'netlify' && <NetlifyFields config={netlify} onChange={setNetlify} />}
      {provider === 'github' && <GitHubFields config={github} onChange={setGithub} />}

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {notes.length > 0 && (
        <ul role="status" className="space-y-1 text-sm text-muted-foreground">
          {notes.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {saved ? (
        <Button onClick={onComplete}>Continue</Button>
      ) : (
        <Button disabled={busy} onClick={() => void submit()}>
          {provider === 'zip' ? 'Continue' : 'Test connection and continue'}
        </Button>
      )}
    </div>
  );
}
