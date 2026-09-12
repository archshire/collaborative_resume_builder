if (window.location.pathname.replace(/\/$/, '') === '/interview') {
  await import('./main');
} else {
  await import('./native-shell');
}
export {};
