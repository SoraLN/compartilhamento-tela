package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"time"
)

//go:embed web/*
var webFiles embed.FS

// main prepara as rotas HTTP e inicia o servidor da aplicação.
func main() {
	staticFiles, err := fs.Sub(webFiles, "web")
	if err != nil {
		log.Fatal(err)
	}

	callServer := &server{rooms: make(map[string][]*client)}
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", callServer.handleWebSocket)
	mux.Handle("/", http.FileServer(http.FS(staticFiles)))

	httpServer := &http.Server{
		Addr:              ":8080",
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("La Noches disponível em http://localhost%s", httpServer.Addr)
	log.Fatal(httpServer.ListenAndServe())
}
