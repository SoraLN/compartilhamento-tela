package main

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/gorilla/websocket"
)

const maxParticipants = 5

// roomPattern aceita códigos de sala curtos formados por letras, números e hífens.
var roomPattern = regexp.MustCompile(`^[a-zA-Z0-9-]{3,32}$`)

// signalMessage representa mensagens de entrada, saída e sinalização WebRTC.
type signalMessage struct {
	Type    string              `json:"type"`
	Data    json.RawMessage     `json:"data,omitempty"`
	Role    string              `json:"role,omitempty"`
	Text    string              `json:"text,omitempty"`
	Name    string              `json:"name,omitempty"`
	ID      string              `json:"id,omitempty"`
	From    string              `json:"from,omitempty"`
	To      string              `json:"to,omitempty"`
	Host    string              `json:"hostId,omitempty"`
	Peers   []string            `json:"peers,omitempty"`
	Members []participantInfo   `json:"members,omitempty"`
	Count   int                 `json:"count,omitempty"`
}

type participantInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// client mantém uma conexão WebSocket e serializa as escritas nela.
type client struct {
	id      string
	name    string
	conn    *websocket.Conn
	writeMu sync.Mutex
}

// server guarda os participantes agrupados por código de sala.
type server struct {
	mu     sync.Mutex
	rooms  map[string][]*client
	nextID uint64
}

// upgrader converte conexões HTTP válidas em conexões WebSocket.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// send envia uma mensagem WebSocket sem permitir escritas simultâneas.
func (c *client) send(message signalMessage) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return c.conn.WriteJSON(message)
}

// join registra o participante e retorna a lista atual, o host e o limite atingido.
func (s *server) join(room string, newcomer *client) ([]string, string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	participants := s.rooms[room]
	if len(participants) >= maxParticipants {
		return nil, "", false
	}
	s.nextID++
	newcomer.id = strconv.FormatUint(s.nextID, 10)

	hostID := newcomer.id
	peerIDs := make([]string, 0, len(participants))
	if len(participants) > 0 {
		hostID = participants[0].id
	}
	for _, participant := range participants {
		peerIDs = append(peerIDs, participant.id)
	}
	s.rooms[room] = append(participants, newcomer)
	return peerIDs, hostID, true
}

// leave remove um participante e retorna quem permanece e o novo host.
func (s *server) leave(room string, departing *client) ([]*client, string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	participants := s.rooms[room]
	remaining := make([]*client, 0, len(participants))
	for _, participant := range participants {
		if participant == departing {
			continue
		}
		remaining = append(remaining, participant)
	}
	if len(remaining) == 0 {
		delete(s.rooms, room)
	} else {
		s.rooms[room] = remaining
	}

	hostID := ""
	if len(remaining) > 0 {
		hostID = remaining[0].id
	}
	return remaining, hostID
}

func cleanParticipantName(name string) string {
	name = strings.Map(func(character rune) rune {
		if unicode.IsControl(character) {
			return -1
		}
		return character
	}, strings.TrimSpace(name))
	name = strings.TrimSpace(name)
	if name == "" {
		return "Anônimo"
	}

	characters := []rune(name)
	if len(characters) > 32 {
		name = string(characters[:32])
	}
	return name
}

func (s *server) memberList(room string) []participantInfo {
	s.mu.Lock()
	defer s.mu.Unlock()

	members := make([]participantInfo, 0, len(s.rooms[room]))
	for _, participant := range s.rooms[room] {
		members = append(members, participantInfo{ID: participant.id, Name: participant.name})
	}
	return members
}

// handleWebSocket valida a sala, registra o cliente e encaminha a sinalização.
func (s *server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	room := strings.TrimSpace(r.URL.Query().Get("room"))
	if !roomPattern.MatchString(room) {
		http.Error(w, "Código de sala inválido", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	participant := &client{conn: conn, name: cleanParticipantName(r.URL.Query().Get("name"))}
	peerIDs, hostID, joined := s.join(room, participant)
	if !joined {
		_ = participant.send(signalMessage{Type: "error", Text: "Esta sala já atingiu o limite de cinco pessoas."})
		_ = conn.Close()
		return
	}
	// Ao fechar o socket, atualiza a sala e transmite a saída aos participantes restantes.
	defer func() {
		_ = conn.Close()
		remaining, currentHostID := s.leave(room, participant)
		for _, peer := range remaining {
			_ = peer.send(signalMessage{
				Type:  "peer-left",
				ID:    participant.id,
				Host:  currentHostID,
				Count: len(remaining),
			})
		}
	}()

	role := "viewer"
	if participant.id == hostID {
		role = "host"
	}
	if err := participant.send(signalMessage{
		Type:    "joined",
		ID:      participant.id,
		Role:    role,
		Host:    hostID,
		Peers:   peerIDs,
		Members: s.memberList(room),
		Count:   len(peerIDs) + 1,
	}); err != nil {
		return
	}
	joinedMessage := signalMessage{
		Type:  "peer-joined",
		ID:    participant.id,
		Name:  participant.name,
		Host:  hostID,
		Count: len(peerIDs) + 1,
	}
	for _, peerID := range peerIDs {
		if peer := s.participantByID(room, peerID); peer != nil {
			_ = peer.send(joinedMessage)
		}
	}

	conn.SetReadLimit(1 << 20)
	for {
		var message signalMessage
		if err := conn.ReadJSON(&message); err != nil {
			break
		}
		if (message.Type != "offer" && message.Type != "answer" && message.Type != "ice") || message.To == "" {
			continue
		}
		if peer := s.participantByID(room, message.To); peer != nil {
			message.From = participant.id
			if err := peer.send(message); err != nil {
				break
			}
		}
	}
}

// participantByID encontra um participante pelo ID dentro da sala informada.
func (s *server) participantByID(room string, participantID string) *client {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, candidate := range s.rooms[room] {
		if candidate.id == participantID {
			return candidate
		}
	}
	return nil
}