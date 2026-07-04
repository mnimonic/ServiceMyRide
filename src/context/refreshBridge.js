// Tiny event bridge so AuthContext (after a Drive sync/restore) can tell
// AppContext to reload local data, without either importing the other.
let refreshFn = null;

export function setRefresh(fn) {
  refreshFn = fn;
}

export function triggerRefresh() {
  if (refreshFn) refreshFn();
}
