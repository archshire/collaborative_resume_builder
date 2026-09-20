import './hosting.css';

const root = document.querySelector<HTMLDivElement>('#app')!;
type Session = { required: boolean; authenticated: boolean; reachable: boolean };
// An unanswerable access check must never open the demo. The Vite dev server has no backend by
// design, but a production build without one is a broken deployment, so it refuses to mount.
const unverifiable = (): Session => import.meta.env.DEV
  ? { required: false, authenticated: true, reachable: true }
  : { required: true, authenticated: false, reachable: false };
async function sessionState(): Promise<Session> {
  try {
    const response = await fetch('/api/demo-session', { headers: { Accept: 'application/json' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return unverifiable();
    const parsed = await response.json();
    if (typeof parsed?.required !== 'boolean' || typeof parsed?.authenticated !== 'boolean') return unverifiable();
    return { required: parsed.required, authenticated: parsed.authenticated, reachable: true };
  } catch { return unverifiable(); }
}
async function mountApplication() {
  if (window.location.pathname.replace(/\/$/, '') === '/interview') await import('./main');
  else await import('./native-shell');
}
const session = await sessionState();
if (!session.reachable) {
  root.innerHTML = `<main class="hosting-gate"><section><p class="hosting-eyebrow">Private CRB demonstration</p><h1>Demonstration unavailable</h1><p>CRB cannot reach its server, so it cannot check whether this demonstration is password protected. It will not open without that check.</p><p>If you are hosting this, confirm the service is running the Node server (<code>npm run serve</code>) rather than serving the built files on their own.</p></section></main>`;
} else if (!session.required || session.authenticated) await mountApplication();
else {
  root.innerHTML = `<main class="hosting-gate"><section><p class="hosting-eyebrow">Private CRB demonstration</p><h1>Enter the demonstration</h1><p>Use the access password supplied by the project owner. Information entered during this demonstration is temporary and is lost when the browser session is cleared.</p><form id="hosting-login"><label for="hosting-password">Demonstration access password</label><input id="hosting-password" type="password" autocomplete="current-password" required maxlength="256"><button type="submit">Enter CRB</button><p id="hosting-error" role="alert"></p></form></section></main>`;
  const form = document.querySelector<HTMLFormElement>('#hosting-login')!;
  form.onsubmit = async event => {
    event.preventDefault();
    const button = form.querySelector<HTMLButtonElement>('button')!;
    const error = document.querySelector<HTMLElement>('#hosting-error')!;
    button.disabled = true; button.textContent = 'Checking access…'; error.textContent = '';
    try {
      const response = await fetch('/api/demo-login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Resume-Client': '1' }, body: JSON.stringify({ password: (document.querySelector<HTMLInputElement>('#hosting-password')!).value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Access could not be verified.');
      root.replaceChildren(); await mountApplication();
    } catch (caught) {
      error.textContent = caught instanceof Error ? caught.message : 'Access could not be verified.';
      button.disabled = false; button.textContent = 'Enter CRB';
    }
  };
}
export {};
