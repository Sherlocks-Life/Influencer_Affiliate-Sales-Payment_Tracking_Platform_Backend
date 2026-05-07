let ioRef = null;

export function setSocket(io) {
  ioRef = io;
}

export function emitEvent(event, payload) {
  if (ioRef) ioRef.emit(event, payload);
}
