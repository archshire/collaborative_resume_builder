import './hosting.css';

const root = document.querySelector<HTMLDivElement>('#app')!;
async function sessionState(): Promise<{ required: boolean; authenticated: boolean }> {
  try {
    const response = await fetch('/api/demo-session', { headers: { Accept: 'application/json' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return { required: false, authenticated: true };
    return await response.json();
  } catch { return { required: false, authenticated: true }; }
}
async function mountApplication() {
  if (window.location.pathname.replace(/\/$/, '') === '/interview') await import('./main');
  else await import('./native-shell');
}
const session = await sessionState();
if (!session.required || session.authenticated) await mountApplication();
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
