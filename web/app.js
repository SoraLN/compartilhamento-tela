import { startCall, endCall } from './js/call.mjs';
import { cleanRoomCode, copyInvitation, generateRoomCode } from './js/room.mjs';
import { elements, showToast } from './js/ui.mjs';

const { roomInput, nameInput, joinButton, generateButton, copyButton, leaveButton, stage, fullscreenButton, themeOptions } = elements;

function applyTheme(theme) {
  const selectedTheme = themeOptions.some((option) => option.dataset.theme === theme) ? theme : 'default';
  document.documentElement.dataset.theme = selectedTheme;
  themeOptions.forEach((option) => {
    option.setAttribute('aria-pressed', String(option.dataset.theme === selectedTheme));
  });
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim();
}

function handleThemeSelection(event) {
  const theme = event.currentTarget.dataset.theme;
  applyTheme(theme);
  try {
    localStorage.setItem('lanoches-theme', theme);
  } catch (error) {
    console.warn('Não foi possível salvar o tema escolhido:', error);
    showToast('O tema foi aplicado, mas não pôde ser salvo neste navegador.');
  }
}

function updateFullscreenButton() {
  const isFullscreen = document.fullscreenElement === stage;
  const label = fullscreenButton.querySelector('span:last-child');
  label.textContent = isFullscreen ? 'Sair da tela cheia' : 'Tela cheia';
  fullscreenButton.setAttribute('aria-label', isFullscreen ? 'Sair da tela cheia' : 'Expandir vídeo para tela cheia');
  fullscreenButton.setAttribute('aria-pressed', String(isFullscreen));
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === stage) {
      await document.exitFullscreen();
    } else if (stage.requestFullscreen) {
      await stage.requestFullscreen();
    } else {
      showToast('A tela cheia não é compatível com este navegador.');
    }
  } catch (error) {
    console.error(error);
    showToast('Não foi possível expandir o vídeo para tela cheia.');
  }
}

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
nameInput.addEventListener('keydown', handleRoomKeydown);
fullscreenButton.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', updateFullscreenButton);
themeOptions.forEach((option) => option.addEventListener('click', handleThemeSelection));

try {
  applyTheme(localStorage.getItem('lanoches-theme') || 'default');
} catch (error) {
  console.warn('Não foi possível carregar o tema salvo:', error);
  applyTheme('default');
}

const roomFromUrl = new URLSearchParams(window.location.search).get('room');
roomInput.value = roomFromUrl ? cleanRoomCode(roomFromUrl) : generateRoomCode();
