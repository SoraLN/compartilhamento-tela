import { elements as ui, setParticipantCount, setState, showToast } from './ui.mjs';
import { cleanRoomCode } from './room.mjs';

let localStream;
let socket;
let localID = '';
let hostID = '';
let callRole = '';
let activeRoom = '';
let pendingRoomSignals = [];
const participants = new Set();
const peerConnections = new Map();
const pendingCandidates = new Map();

// Adiciona a faixa compartilhada à conexão do espectador atual.
function addLocalTrack(connection, track) {
  connection.addTrack(track, localStream);
}

// Informa se uma conexão WebRTC já está ativa.
function isConnected(connection) {
  return connection.connectionState === 'connected';
}

// Informa se uma conexão WebRTC falhou.
function isConnectionFailed(connection) {
  return connection.connectionState === 'failed';
}

// Informa se uma conexão WebRTC está negociando a sessão.
function isConnecting(connection) {
  return connection.connectionState === 'connecting';
}

// Informa se uma conexão WebRTC foi interrompida.
function isDisconnected(connection) {
  return connection.connectionState === 'disconnected';
}

// Guarda o ID de participante recebido na lista inicial da sala.
function addParticipant(peerID) {
  participants.add(peerID);
}

// Envia sinalização ao participante indicado enquanto o socket estiver aberto.
function sendSignal(type, data, to) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, data, to }));
}

// Mostra apenas o estado vazio e oculta elementos da chamada anterior.
function showEmptyStage() {
  ui.emptyState.hidden = false;
  ui.remotePlaceholder.hidden = true;
  ui.remoteVideo.hidden = true;
}

// Mostra o estado de espera sem sobrepor o ícone vazio.
function showWaitingStage(label) {
  ui.emptyState.hidden = true;
  ui.remoteVideo.hidden = true;
  ui.remotePlaceholder.hidden = false;
  ui.remoteLabel.textContent = label;
}

// Atualiza o número de pessoas presentes com o limite da sala.
function updateParticipantCount(count) {
  setParticipantCount(count);
}

// Atualiza o estado visual conforme as conexões WebRTC ativas.
function updateConnectionState() {
  const connections = [...peerConnections.values()];
  if (connections.some(isConnected)) {
    if (callRole === 'host') ui.remoteLabel.textContent = 'Tela compartilhada';
    setState(callRole === 'host' ? 'Compartilhando' : 'Conectado', 'live');
    return;
  }
  if (connections.some(isConnectionFailed)) {
    setState('Falha na conexão');
    return;
  }
  if (connections.some(isDisconnected)) {
    setState('Reconectando', 'waiting');
    return;
  }
  if (connections.some(isConnecting)) {
    setState('Conectando', 'waiting');
    return;
  }
  setState(callRole === 'host' ? 'Aguardando amigo' : 'Conectando', 'waiting');
}

// Envia candidatos ICE locais ao mesmo participante da conexão correspondente.
function handleIceCandidate(peerID, event) {
  if (event.candidate) sendSignal('ice', event.candidate, peerID);
}

// Exibe a tela recebida do host e oculta os estados de espera.
function handleRemoteTrack(peerID, event) {
  if (peerID !== hostID) return;
  if (event.track.kind === 'video') {
    ui.remoteVideo.srcObject = event.streams[0];
    ui.remoteVideo.hidden = false;
    ui.remotePlaceholder.hidden = true;
    ui.emptyState.hidden = true;
  }
  if (event.track.kind === 'audio') {
    ui.remoteAudio.srcObject = event.streams[0];
    ui.remoteAudio.play().catch(handleAudioPlaybackBlocked);
  }
}

// Informa quando o navegador exige interação para liberar o áudio remoto.
function handleAudioPlaybackBlocked() {
  showToast('Clique na página para ativar o áudio compartilhado.');
}

// Cria ou recupera a conexão WebRTC entre o host e um espectador.
function createPeerConnection(peerID) {
  const existingConnection = peerConnections.get(peerID);
  if (existingConnection) return existingConnection;

  const connection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  peerConnections.set(peerID, connection);

  if (callRole === 'host' && localStream) {
    localStream.getTracks().forEach(addLocalTrack.bind(null, connection));
  }

  connection.onicecandidate = handleIceCandidate.bind(null, peerID);
  connection.ontrack = handleRemoteTrack.bind(null, peerID);
  connection.onconnectionstatechange = updateConnectionState;
  return connection;
}

// Cria e envia uma oferta WebRTC endereçada a um espectador.
async function createOffer(peerID) {
  const connection = createPeerConnection(peerID);
  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  sendSignal('offer', connection.localDescription, peerID);
}

// Aplica candidatos ICE que chegaram antes da descrição remota.
async function flushPendingCandidates(peerID, connection) {
  const candidates = pendingCandidates.get(peerID) || [];
  pendingCandidates.delete(peerID);
  for (const candidate of candidates) {
    try {
      await connection.addIceCandidate(candidate);
    } catch (error) {
      console.warn('Candidato ICE ignorado:', error);
    }
  }
}

// Prepara a interface da sala sem deixar o ícone e a espera visíveis juntos.
function showRoom() {
  ui.emptyState.hidden = true;
  ui.remoteVideo.hidden = true;
  ui.remotePlaceholder.hidden = false;
  ui.callControls.hidden = false;
  ui.remoteLabel.textContent = callRole === 'host' ? 'Aguardando amigo' : 'Conectando à tela';
}

// Processa entrada, saída e sinalização de todos os participantes da sala.
async function handleSignal(message) {
  if (message.type !== 'joined' && !localID) {
    pendingRoomSignals.push(message);
    return;
  }

  if (message.type === 'joined') {
    localID = message.id;
    hostID = message.hostId;
    callRole = localID === hostID ? 'host' : 'viewer';
    participants.clear();
    (message.peers || []).forEach(addParticipant);
    updateParticipantCount(message.count || participants.size + 1);
    showRoom();
    ui.joinButton.querySelector('span:last-child').textContent = callRole === 'host' ? 'Selecionando tela…' : 'Na chamada';
    setState(callRole === 'host' ? 'Selecione a tela' : 'Conectando', 'waiting');
    if (callRole === 'host') await startScreenShare();
    const queuedSignals = pendingRoomSignals;
    pendingRoomSignals = [];
    for (const queuedMessage of queuedSignals) await handleSignal(queuedMessage);
    return;
  }

  if (message.type === 'peer-joined') {
    if (!message.id || message.id === localID) return;
    participants.add(message.id);
    updateParticipantCount(message.count || participants.size + 1);
    if (callRole === 'host' && localStream) {
      ui.remoteLabel.textContent = 'Conectando à tela';
      setState('Conectando', 'waiting');
      await createOffer(message.id);
    }
    return;
  }

  if (message.type === 'offer') {
    const connection = createPeerConnection(message.from);
    await connection.setRemoteDescription(message.data);
    await flushPendingCandidates(message.from, connection);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    sendSignal('answer', connection.localDescription, message.from);
    return;
  }

  if (message.type === 'answer') {
    const connection = peerConnections.get(message.from);
    if (!connection) return;
    await connection.setRemoteDescription(message.data);
    await flushPendingCandidates(message.from, connection);
    return;
  }

  if (message.type === 'ice') {
    const connection = peerConnections.get(message.from);
    if (!connection?.remoteDescription) {
      const candidates = pendingCandidates.get(message.from) || [];
      candidates.push(message.data);
      pendingCandidates.set(message.from, candidates);
    } else {
      try {
        await connection.addIceCandidate(message.data);
      } catch (error) {
        console.warn('Candidato ICE ignorado:', error);
      }
    }
    return;
  }

  if (message.type === 'peer-left') {
    participants.delete(message.id);
    updateParticipantCount(message.count ?? participants.size + 1);
    closePeerConnection(message.id);
    pendingCandidates.delete(message.id);

    if (message.hostId && message.hostId !== hostID) {
      closeAllPeerConnections();
      hostID = message.hostId;
      callRole = localID === hostID ? 'host' : 'viewer';
      ui.remoteVideo.srcObject = null;
      ui.remoteAudio.srcObject = null;
      ui.remoteVideo.hidden = true;
      showWaitingStage(callRole === 'host' ? 'Selecione a tela' : 'Aguardando compartilhamento');
      setState(callRole === 'host' ? 'Selecione a tela' : 'Aguardando tela', 'waiting');
      if (callRole === 'host') await startScreenShare();
      return;
    }

    if (callRole === 'host') {
      showWaitingStage('Aguardando amigo');
      updateConnectionState();
    } else if (message.id === hostID) {
      ui.remoteVideo.srcObject = null;
      ui.remoteAudio.srcObject = null;
      showWaitingStage('Aguardando compartilhamento');
      setState('Aguardando host', 'waiting');
    }
    return;
  }

  if (message.type === 'error') {
    showToast(message.text || 'Não foi possível entrar na sala.');
    await endCall();
  }
}

// Captura a tela do host e negocia uma conexão com cada espectador presente.
async function startScreenShare() {
  try {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('O compartilhamento de tela exige HTTPS ou localhost.');
    }
    localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const screenTrack = localStream.getVideoTracks()[0];
    if (!screenTrack) throw new Error('Nenhuma tela foi selecionada.');
    screenTrack.onended = endCall;
    ui.localVideo.srcObject = localStream;
    ui.localTile.hidden = false;
    ui.joinButton.querySelector('span:last-child').textContent = 'Tela compartilhada';

    if (localStream.getAudioTracks().length === 0) {
      showToast('Sem áudio nesta captura. Ative “Compartilhar áudio do sistema” ao escolher a tela.');
    }
    showWaitingStage('Aguardando amigo');
    setState('Aguardando amigo', 'waiting');
    await Promise.all([...participants].map(createOffer));
  } catch (error) {
    console.error(error);
    if (error.name === 'NotAllowedError') showToast('Compartilhamento cancelado. Selecione uma tela para iniciar a sala.');
    else showToast(error.message || 'Não foi possível compartilhar a tela.');
    await endCall();
  }
}

// Exibe erros inesperados ao interpretar uma mensagem de sinalização.
async function handleSocketMessage(event) {
  try {
    await handleSignal(JSON.parse(event.data));
  } catch (error) {
    console.error(error);
    showToast('Ocorreu um erro ao conectar a chamada.');
  }
}

// Atualiza o estado se o WebSocket fechar sem uma saída solicitada.
function handleSocketClose() {
  if (callRole) setState('Conexão encerrada');
}

// Informa quando não foi possível alcançar o servidor de sinalização.
function handleSocketError() {
  showToast('Não foi possível conectar ao servidor da sala.');
}

// Fecha e remove a conexão WebRTC de um participante específico.
function closePeerConnection(peerID) {
  const connection = peerConnections.get(peerID);
  if (!connection) return;
  connection.onicecandidate = null;
  connection.ontrack = null;
  connection.onconnectionstatechange = null;
  connection.close();
  peerConnections.delete(peerID);
}

// Fecha todas as conexões WebRTC antes de trocar o host da sala.
function closeAllPeerConnections() {
  for (const peerID of peerConnections.keys()) closePeerConnection(peerID);
  pendingCandidates.clear();
}

// Valida o código da sala e abre a conexão WebSocket.
export async function startCall() {
  if (ui.joinButton.disabled || socket) return;

  const room = cleanRoomCode(ui.roomInput.value);
  if (room.length < 3) {
    showToast('Use um código com pelo menos 3 caracteres.');
    ui.roomInput.focus();
    return;
  }

  activeRoom = room;
  ui.joinButton.disabled = true;
  ui.joinButton.querySelector('span:last-child').textContent = 'Conectando…';
  setState('Conectando', 'waiting');
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}/ws?room=${encodeURIComponent(room)}`);
    socket.onmessage = handleSocketMessage;
    socket.onclose = handleSocketClose;
    socket.onerror = handleSocketError;
  } catch (error) {
    console.error(error);
    showToast('Não foi possível conectar ao servidor da sala.');
    await endCall();
  }
}

// Encerra a chamada e volta ao estado vazio sem sobrepor o placeholder.
export async function endCall() {
  closeAllPeerConnections();
  if (socket) {
    const currentSocket = socket;
    socket = null;
    currentSocket.onclose = null;
    currentSocket.close();
  }
  for (const track of localStream?.getTracks() ?? []) {
    track.onended = null;
    track.stop();
  }

  localStream = null;
  localID = '';
  hostID = '';
  callRole = '';
  activeRoom = '';
  participants.clear();
  pendingRoomSignals = [];
  updateParticipantCount(0);
  ui.joinButton.disabled = false;
  ui.joinButton.querySelector('span:last-child').textContent = 'Entrar na chamada';
  ui.localVideo.srcObject = null;
  ui.remoteVideo.srcObject = null;
  ui.remoteAudio.srcObject = null;
  ui.localTile.hidden = true;
  ui.callControls.hidden = true;
  showEmptyStage();
  setState('Pronto');
}
