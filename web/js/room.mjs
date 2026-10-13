function formatRandomByte(byte) {
  return byte.toString(16).padStart(2, '0');
}

export function generateRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, formatRandomByte).join('');
}

export function cleanRoomCode(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
}

export function invitationUrl(roomInput) {
  const room = cleanRoomCode(roomInput.value);
  return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room)}`;
}

// Valida o código e copia o convite, exibindo feedback em caso de falha.
export async function copyInvitation(roomInput, showToast) {
  const room = cleanRoomCode(roomInput.value);
  if (room.length < 3) {
    showToast('Digite ou gere um código de sala primeiro.');
    roomInput.focus();
    return;
  }
  try {
    await navigator.clipboard.writeText(invitationUrl(roomInput));
    showToast('Convite copiado. Mande para seu amigo!');
  } catch {
    showToast(`Código da sala: ${room}`);
  }
}