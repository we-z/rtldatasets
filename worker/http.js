export function redirect(location, status = 308) {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
