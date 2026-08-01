(() => {
  const form = document.querySelector('#sample-checkout-form');
  const button = document.querySelector('#purchase-button');
  const status = document.querySelector('#store-status');
  const attemptInput = document.querySelector('#checkout-attempt-id');
  if (!form || !button || !status || !attemptInput) return;

  const randomUuid = () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  attemptInput.value = randomUuid();
  const query = new URLSearchParams(window.location.search);
  const checkoutCancelled = query.get('checkout') === 'cancelled';
  if (checkoutCancelled) {
    status.textContent = 'Checkout was canceled. You have not been charged.';
  }

  fetch('/api/store-status', { cache: 'no-store', credentials: 'same-origin' })
    .then((response) => {
      if (!response.ok) throw new Error('Status unavailable');
      return response.json();
    })
    .then((data) => {
      if (data.available !== true) throw new Error('Checkout unavailable');
      button.disabled = false;
      button.textContent = 'Buy the five-task sample — $1,000';
      status.textContent = checkoutCancelled
        ? 'Checkout was canceled. You have not been charged; you may try again.'
        : 'Checkout is available. Delivery is automated after payment.';
    })
    .catch(() => {
      button.disabled = true;
      button.textContent = 'Checkout temporarily unavailable';
      status.textContent = checkoutCancelled
        ? 'Checkout was canceled. You have not been charged. Email root@puul.ai if you need help.'
        : 'Email root@puul.ai to purchase or ask when secure checkout will be available.';
    });

  form.addEventListener('submit', () => {
    button.disabled = true;
    button.textContent = 'Opening secure checkout…';
    status.textContent = 'Redirecting to Stripe. Please do not submit twice.';
  });
})();
