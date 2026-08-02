(() => {
  const form = document.querySelector('#sample-checkout-form');
  const button = document.querySelector('#purchase-button');
  const status = document.querySelector('#store-status');
  const attemptInput = document.querySelector('#checkout-attempt-id');
  if (!form || !button || !status || !attemptInput) return;

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });

  const attemptStorageKey = 'rtl_checkout_attempts_v1';
  const attemptLifetimeMs = 7 * 24 * 60 * 60 * 1000;
  const maxAttempts = 20;
  const validAttemptId = (value) =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const loadAttempts = () => {
    try {
      const now = Date.now();
      const stored = JSON.parse(localStorage.getItem(attemptStorageKey) || '[]');
      const seen = new Set();
      const recent = Array.isArray(stored)
        ? stored.filter((item) => {
          if (
            !item || !validAttemptId(item.id) || !Number.isFinite(item.created) ||
            now - item.created >= attemptLifetimeMs
          ) return false;
          const normalized = item.id.toLowerCase();
          if (seen.has(normalized)) return false;
          seen.add(normalized);
          return true;
        }).slice(0, maxAttempts)
        : [];
      localStorage.setItem(attemptStorageKey, JSON.stringify(recent));
      return recent;
    } catch {
      return [];
    }
  };

  const forgetAttemptAt = (attempts, index) => {
    if (!Number.isInteger(index) || index < 0 || index >= attempts.length) return;
    try {
      const completedId = attempts[index].id.toLowerCase();
      const retained = loadAttempts().filter((item) => item.id.toLowerCase() !== completedId);
      localStorage.setItem(attemptStorageKey, JSON.stringify(retained));
    } catch {
      // The short-lived signed checkout cookie is cleared by the server.
    }
  };

  const randomUuid = () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  const rememberAttempt = (attemptId) => {
    try {
      const now = Date.now();
      const recent = loadAttempts().filter(
        (item) => item.id.toLowerCase() !== attemptId.toLowerCase(),
      );
      localStorage.setItem(
        attemptStorageKey,
        JSON.stringify([{ id: attemptId, created: now }, ...recent].slice(0, maxAttempts)),
      );
    } catch {
      // The signed first-party checkout cookie remains the primary proof.
    }
  };

  const recoverPendingPurchase = async (checkoutCancelled) => {
    const attempts = loadAttempts();
    if (attempts.length === 0) return;
    const body = new URLSearchParams();
    for (const attempt of attempts) body.append('attempt_id', attempt.id);
    const recentCheckout = Date.now() - attempts[0].created < 10 * 60 * 1000;
    const delays = !checkoutCancelled && recentCheckout ? [0, 1500, 3000, 6000] : [0];

    for (const delay of delays) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const response = await fetch('/api/recover-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: body.toString(),
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data.recovered === true && data.redirect === '/purchase-success') {
          forgetAttemptAt(attempts, data.matchedAttemptIndex);
          window.location.replace(data.redirect);
          return;
        }
      } catch {
        // A later bounded retry can recover a transient network or webhook delay.
      }
    }
  };

  attemptInput.value = randomUuid();
  const query = new URLSearchParams(window.location.search);
  const checkoutCancelled = query.get('checkout') === 'cancelled';
  if (checkoutCancelled) {
    status.textContent = 'Checkout was canceled. No purchase was completed.';
  }

  void recoverPendingPurchase(checkoutCancelled);

  fetch('/api/store-status', { cache: 'no-store', credentials: 'same-origin' })
    .then((response) => {
      if (!response.ok) throw new Error('Status unavailable');
      return response.json();
    })
    .then((data) => {
      if (data.available !== true) throw new Error('Checkout unavailable');
      button.disabled = false;
      button.style.cursor = 'pointer';
      button.style.opacity = '1';
      button.textContent = 'Purchase the five-task sample';
      status.textContent = checkoutCancelled
        ? 'Checkout was canceled. No purchase was completed; you may try again.'
        : 'Checkout is available. Delivery is automated after payment.';
    })
    .catch(() => {
      button.disabled = true;
      button.style.cursor = 'not-allowed';
      button.style.opacity = '0.55';
      button.textContent = 'Checkout temporarily unavailable';
      status.textContent = checkoutCancelled
        ? 'Checkout was canceled. No purchase was completed. Email root@puul.ai if you need help.'
        : 'Email root@puul.ai to purchase or ask when secure checkout will be available.';
    });

  form.addEventListener('submit', () => {
    rememberAttempt(attemptInput.value);
    button.disabled = true;
    button.style.cursor = 'not-allowed';
    button.style.opacity = '0.55';
    button.textContent = 'Opening secure checkout…';
    status.textContent = 'Redirecting to Stripe. Please do not submit twice.';
  });
})();
