(() => {
  const status = document.querySelector('#completion-status');
  if (!status) return;

  const sessionId = new URLSearchParams(window.location.search).get('session_id') || '';
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]{12,200}$/.test(sessionId)) {
    status.textContent = 'This checkout return is missing a valid Stripe session. Contact root@puul.ai for help.';
    return;
  }

  const attemptStorageKey = 'rtl_checkout_attempts_v1';
  const loadAttempts = () => {
    try {
      const now = Date.now();
      const seen = new Set();
      const stored = JSON.parse(localStorage.getItem(attemptStorageKey) || '[]');
      const attempts = Array.isArray(stored) ? stored.filter((item) => {
        if (
          !item || typeof item.id !== 'string' || !Number.isFinite(item.created) ||
          now - item.created >= 7 * 24 * 60 * 60 * 1000 ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)
        ) return false;
        const normalized = item.id.toLowerCase();
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      }).slice(0, 20) : [];
      localStorage.setItem(attemptStorageKey, JSON.stringify(attempts));
      return attempts;
    } catch {
      return [];
    }
  };

  const attempts = loadAttempts();
  const body = new URLSearchParams({ session_id: sessionId });
  for (const attempt of attempts) body.append('attempt_id', attempt.id);

  const forgetAttemptAt = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= attempts.length) return;
    try {
      const completedId = attempts[index].id.toLowerCase();
      const retained = loadAttempts().filter((item) => item.id.toLowerCase() !== completedId);
      localStorage.setItem(attemptStorageKey, JSON.stringify(retained));
    } catch {
      // The server also clears the short-lived signed checkout cookie.
    }
  };

  const delays = [0, 1000, 2000, 4000, 8000];
  const complete = async () => {
    for (const delay of delays) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const response = await fetch('/api/checkout-success', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: body.toString(),
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.complete === true && data.redirect === '/purchase-success') {
          forgetAttemptAt(data.matchedAttemptIndex);
          window.location.replace(data.redirect);
          return;
        }
        if (data.error === 'terms_reacceptance_required') {
          window.location.replace('/purchase-error?reason=terms_reacceptance_required');
          return;
        }
        if (response.status >= 400 && response.status < 500) {
          status.textContent = 'We could not verify this checkout return. Contact root@puul.ai for help.';
          return;
        }
      } catch {
        // Retry a bounded number of times for a transient connection failure.
      }
      status.textContent = 'Payment verification is taking longer than expected. Retrying automatically—keep this page open.';
    }
    status.textContent = 'Automatic verification is still unavailable. Reload this page to retry, or contact root@puul.ai for help.';
  };

  status.textContent = 'Stripe confirmed the return. Verifying payment and preparing private access…';
  void complete();
})();
