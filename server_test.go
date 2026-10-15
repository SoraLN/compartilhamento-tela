package main

import "testing"

// TestJoinEnforcesFiveParticipants verifies the room limit and host stability.
func TestJoinEnforcesFiveParticipants(t *testing.T) {
	callServer := &server{rooms: make(map[string][]*client)}
	hostID := ""

	for index := 0; index < maxParticipants; index++ {
		peers, currentHostID, joined := callServer.join("room", &client{})
		if !joined {
			t.Fatalf("participant %d was rejected", index+1)
		}
		if len(peers) != index {
			t.Fatalf("participant %d received %d existing peers", index+1, len(peers))
		}
		if index == 0 {
			hostID = currentHostID
		} else if currentHostID != hostID {
			t.Fatalf("host changed before leaving: got %q, want %q", currentHostID, hostID)
		}
	}

	if _, _, joined := callServer.join("room", &client{}); joined {
		t.Fatal("sixth participant was accepted")
	}
}

// TestLeavePromotesNextParticipant verifies host handoff after departure.
func TestLeavePromotesNextParticipant(t *testing.T) {
	callServer := &server{rooms: make(map[string][]*client)}
	first := &client{}
	second := &client{}
	callServer.join("room", first)
	callServer.join("room", second)

	remaining, hostID := callServer.leave("room", first)
	if len(remaining) != 1 {
		t.Fatalf("got %d remaining participants, want 1", len(remaining))
	}
	if hostID != second.id {
		t.Fatalf("got host %q, want %q", hostID, second.id)
	}
}

func TestCleanParticipantName(t *testing.T) {
	tests := []struct {
		name string
		want string
	}{
		{name: "  Alice  ", want: "Alice"},
		{name: "   ", want: "Anônimo"},
		{name: "A\nlice", want: "Alice"},
		{name: "123456789012345678901234567890123", want: "12345678901234567890123456789012"},
	}

	for _, test := range tests {
		if got := cleanParticipantName(test.name); got != test.want {
			t.Errorf("cleanParticipantName(%q) = %q, want %q", test.name, got, test.want)
		}
	}
}
