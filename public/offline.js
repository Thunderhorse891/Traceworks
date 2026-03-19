const retryConnectionBtn = document.getElementById('retryConnectionBtn');

retryConnectionBtn?.addEventListener('click', () => {
  location.reload();
});

window.addEventListener('online', () => {
  location.reload();
});
