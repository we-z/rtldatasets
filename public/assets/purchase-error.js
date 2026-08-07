'use strict';

if (new URLSearchParams(window.location.search).get('reason') === 'terms_reacceptance_required') {
  document.querySelector('#purchase-error-message').textContent =
    'Your payment record does not contain acceptance of both exact purchase documents. ' +
    'Download access is paused until support records your explicit written reacceptance.';
}
