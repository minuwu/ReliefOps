import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { USE_MOCK, switchDataMode } from '@/services/http';
import { checkApiHealth, normalizeApiUrl, resolveApiUrl } from '@/services/dataMode';
import { cn } from '@/lib/utils';

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; url: string; ai: string }
  | { kind: 'error'; message: string };

const SEGMENT =
  'px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#09090B]';

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Footer control: Demo data (in-browser) or Live data (a real ReliefOps API). */
export function DataModeSwitch() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [urlInput, setUrlInput] = useState(resolveApiUrl);
  const [check, setCheck] = useState<CheckState>({ kind: 'idle' });

  const openDialog = () => {
    setUrlInput(resolveApiUrl());
    setCheck({ kind: 'idle' });
    setIsDialogOpen(true);
  };

  const runCheck = async (): Promise<CheckState> => {
    const url = normalizeApiUrl(urlInput);
    if (!url) {
      const invalid: CheckState = { kind: 'error', message: 'Enter a full URL starting with https:// or http://.' };
      setCheck(invalid);
      return invalid;
    }
    setCheck({ kind: 'checking' });
    const result = await checkApiHealth(url);
    const next: CheckState = result.ok
      ? { kind: 'ok', url, ai: result.ai }
      : { kind: 'error', message: result.reason };
    setCheck(next);
    return next;
  };

  const connect = async () => {
    const result = check.kind === 'ok' ? check : await runCheck();
    if (result.kind === 'ok') switchDataMode('live', result.url);
  };

  return (
    <div className="flex items-center gap-2">
      <span id="data-mode-label">Data</span>
      <div
        role="group"
        aria-labelledby="data-mode-label"
        className="inline-flex rounded-lg border border-[#09090B] overflow-hidden"
      >
        <button
          type="button"
          aria-pressed={USE_MOCK}
          onClick={() => !USE_MOCK && switchDataMode('demo')}
          className={cn(SEGMENT, USE_MOCK ? 'bg-[#09090B] text-[#F8F4E8]' : 'text-[#09090B] hover:bg-[#EDE8D5]')}
        >
          Demo
        </button>
        <button
          type="button"
          aria-pressed={!USE_MOCK}
          onClick={openDialog}
          className={cn(
            SEGMENT,
            'border-l border-[#09090B]',
            !USE_MOCK ? 'bg-[#09090B] text-[#F8F4E8]' : 'text-[#09090B] hover:bg-[#EDE8D5]'
          )}
        >
          Live
        </button>
      </div>
      {!USE_MOCK && (
        <span className="font-mono" title={resolveApiUrl()}>
          {hostOf(resolveApiUrl())}
        </span>
      )}

      <Modal
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Use live data"
        description="Connect to a running ReliefOps API. You will be signed out and need a real account there."
        maxWidth="md"
      >
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void connect();
          }}
        >
          <Input
            id="live-api-url"
            label="API URL"
            type="url"
            inputMode="url"
            autoComplete="url"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setCheck({ kind: 'idle' });
            }}
            helperText="The server address, without /api. Example: https://api.example.com"
            error={check.kind === 'error' ? check.message : undefined}
          />
          {check.kind === 'ok' && (
            <p role="status" className="text-sm text-[#09090B]">
              Connected to {hostOf(check.url)}. AI: {check.ai}.
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void runCheck()}
              isLoading={check.kind === 'checking'}
            >
              Check connection
            </Button>
            <Button type="submit" variant="primary" disabled={check.kind === 'checking'}>
              {USE_MOCK ? 'Switch to live' : 'Reconnect'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
