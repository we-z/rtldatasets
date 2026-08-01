(() => {
  const status = document.querySelector('#redeem-status');
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const token = fragment.get('token');

  // Remove the credential from visible browser history before making a request.
  window.history.replaceState(null, '', '/purchase-access');
  if (!status || !token || token.length > 4096) {
    if (status) status.textContent = 'This access link is missing or invalid. Email root@puul.ai for help.';
    return;
  }

  const form = document.createElement('form');
  form.method = 'post';
  form.action = '/api/redeem';
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'token';
  input.value = token;
  form.append(input);
  document.body.append(form);
  form.submit();
})();
