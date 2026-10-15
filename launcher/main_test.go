package main

import "testing"

func TestTunnelURLPattern(t *testing.T) {
	tests := []struct {
		name string
		line string
		want string
	}{
		{
			name: "extracts tunnel URL from cloudflared output",
			line: "2026-10-15 INF | https://some-room-123.trycloudflare.com",
			want: "https://some-room-123.trycloudflare.com",
		},
		{
			name: "ignores unrelated output",
			line: "Tunnel connection established",
			want: "",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := tunnelURLPattern.FindString(test.line); got != test.want {
				t.Errorf("got %q, want %q", got, test.want)
			}
		})
	}
}
