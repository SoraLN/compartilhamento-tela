export const elements = {
  nameInput: document.querySelector('#name-input'),
  roomInput: document.querySelector('#room-input'),
  stage: document.querySelector('#stage'),
  fullscreenButton: document.querySelector('#fullscreen-button'),
  themeOptions: [...document.querySelectorAll('.theme-option')],
  participantList: document.querySelector('#participant-list'),
  joinButton: document.querySelector('#join-button'),
  generateButton: document.querySelector('#generate-button'),
  copyButton: document.querySelector('#copy-button'),
  leaveButton: document.querySelector('#leave-button'),
  localVideo: document.querySelector('#local-video'),
  remoteVideo: document.querySelector('#remote-video'),
  remoteAudio: document.querySelector('#remote-audio'),
  localTile: document.querySelector('#local-tile'),
  remotePlaceholder: document.querySelector('#remote-placeholder'),
  remoteLabel: document.querySelector('#remote-label'),
  emptyState: document.querySelector('#empty-state'),
  callControls: document.querySelector('#call-controls'),
  participantCount: document.querySelector('#participant-count'),
  stateLabel: document.querySelector('#state-label'),
  connectionState: document.querySelector('#connection-state'),
  toast: document.querySelector('#toast')
};

const icons = {
  screen: '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8m-4-5v5"/>',
  hangup: '<path d="M4.5 15.5a12 12 0 0 1 15 0l-2.2 3.1a1 1 0 0 1-1.3.3l-2.4-1.3a1 1 0 0 1-.5-1v-1.1a10 10 0 0 0-2.2 0v1.1a1 1 0 0 1-.5 1L8 18.9a1 1 0 0 1-1.3-.3Z"/>',
  shuffle: '<path d="m18 14 4 4-4 4m0-20 4 4-4 4M2 18h2.5a6 6 0 0 0 4.2-1.7l6.6-6.6A6 6 0 0 1 19.5 8H22M2 6h2.5a6 6 0 0 1 4.2 1.7l1.3 1.3m4 4 1.3 1.3a6 6 0 0 0 4.2 1.7H22"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7.8a4 4 0 0 1 0 7.6m2 4.2a4 4 0 0 1 2 3.5V21"/>',
  expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/>'
};

// Desenha o SVG correspondente em cada elemento marcado com data-icon.
function renderIcon(element) {
  const icon = icons[element.dataset.icon];
  if (icon) element.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
}

document.querySelectorAll('[data-icon]').forEach(renderIcon);

let toastTimer;

// Oculta a notificação depois do intervalo definido em showToast.
function hideToast() {
  elements.toast.classList.remove('is-visible');
}

// Exibe uma mensagem temporária na área de notificações.
export function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 2600);
}

// Atualiza o texto e o indicador visual do estado da chamada.
export function setState(label, mode = '') {
  elements.stateLabel.textContent = label;
  elements.connectionState.classList.toggle('is-live', mode === 'live');
  elements.connectionState.classList.toggle('is-waiting', mode === 'waiting');
}

// Atualiza a quantidade de participantes conectados à sala.
export function setParticipantCount(count) {
  elements.participantCount.textContent = `${count}/5`;
}

// Atualiza os nomes visíveis sem interpretar texto de participantes como HTML.
export function setParticipants(participants) {
  elements.participantList.replaceChildren(...participants.map(({ name, isLocal }) => {
    const chip = document.createElement('span');
    chip.className = 'participant-chip';
    chip.setAttribute('role', 'listitem');
    chip.textContent = isLocal ? `${name} (você)` : name;
    chip.title = chip.textContent;
    return chip;
  }));
}