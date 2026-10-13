import { startCall, endCall } from './js/call.mjs';
import { cleanRoomCode, copyInvitation, generateRoomCode } from './js/room.mjs';
import { elements, showToast } from './js/ui.mjs';

const { roomInput, joinButton, generateButton, copyButton, leaveButton } = elements;

// Cria um novo código e seleciona o campo para facilitar o compartilhamento.
function handleGenerateRoom() {
  roomInput.value = generateRoomCode();
  roomInput.select();
}

// Copia o convite da sala atual para a área de transferência.
function handleCopyInvitation() {
  copyInvitation(roomInput, showToast);
}

// Remove caracteres inválidos enquanto o código da sala é digitado.
function handleRoomInput() {
  roomInput.value = cleanRoomCode(roomInput.value);
}

// Permite iniciar a chamada pressionando Enter no campo da sala.
function handleRoomKeydown(event) {
  if (event.key === 'Enter') startCall();
}

// Conecta os controles da página às ações da chamada e da sala.
generateButton.addEventListener('click', handleGenerateRoom);
copyButton.addEventListener('click', handleCopyInvitation);
joinButton.addEventListener('click', startCall);
leaveButton.addEventListener('click', endCall);
roomInput.addEventListener('input', handleRoomInput);
roomInput.addEventListener('keydown', handleRoomKeydown);

const roomFromUrl = new URLSearchParams(window.location.search).get('room');
roomInput.value = roomFromUrl ? cleanRoomCode(roomFromUrl) : generateRoomCode();
