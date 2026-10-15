package main

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sync"
)

var tunnelURLPattern = regexp.MustCompile(`https://[a-zA-Z0-9-]+\.trycloudflare\.com`)

func main() {
	if err := run(); err != nil {
		fmt.Println("Error ao iniciar o programa")
		os.Exit(1)
	}
}

func run() error {
	executable, err := os.Executable()
	if err != nil {
		return err
	}

	projectDirectory := filepath.Dir(executable)
	scriptPath := filepath.Join(projectDirectory, "start.ps1")
	if _, err := os.Stat(scriptPath); err != nil {
		return err
	}

	command := exec.Command(
		"powershell.exe",
		"-NoLogo",
		"-NoProfile",
		"-ExecutionPolicy",
		"Bypass",
		"-File",
		scriptPath,
	)
	command.Dir = projectDirectory

	stdout, err := command.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := command.StderrPipe()
	if err != nil {
		return err
	}
	if err := command.Start(); err != nil {
		return err
	}

	var printURL sync.Once
	urlFound := make(chan struct{})
	printMatchingURL := func(line string) {
		if match := tunnelURLPattern.FindString(line); match != "" {
			printURL.Do(func() {
				fmt.Println(match)
				close(urlFound)
			})
		}
	}

	var readers sync.WaitGroup
	readErrors := make(chan error, 2)
	readOutput := func(reader io.Reader) {
		defer readers.Done()
		scanner := bufio.NewScanner(reader)
		scanner.Buffer(make([]byte, 4096), 1024*1024)
		for scanner.Scan() {
			printMatchingURL(scanner.Text())
		}
		readErrors <- scanner.Err()
	}

	readers.Add(2)
	go readOutput(stdout)
	go readOutput(stderr)

	waitErr := command.Wait()
	readers.Wait()
	close(readErrors)

	if waitErr != nil {
		return waitErr
	}
	for scanErr := range readErrors {
		if scanErr != nil {
			return scanErr
		}
	}
	select {
	case <-urlFound:
		return nil
	default:
		return errors.New("Tunnel URL was not found")
	}
}
