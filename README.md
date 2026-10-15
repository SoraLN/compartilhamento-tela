# Tela

## 1. O que a aplicação faz

Permite compartilhar a tela e, quando disponível, o áudio do sistema com até quatro espectadores. Cada pessoa informa um nome, pode escolher um tema de cores e quem assiste pode expandir o vídeo para tela cheia. Não usa webcam nem microfone.

## 2. Como funciona

O servidor Go mantém as salas e encaminha a sinalização entre os navegadores. A tela e o áudio são transmitidos diretamente do computador que compartilha para os espectadores via WebRTC. Para acesso pela internet, o `cloudflared` cria um endereço HTTPS temporário que encaminha a conexão ao servidor local. Não é necessário abrir portas no roteador.

O computador que compartilha precisa manter o programa aberto durante a chamada. O link do Tunnel deixa de funcionar quando a janela é encerrada.

## 3. Dependências

- **Go 1.22 ou mais recente**, instalado e disponível no `PATH`.
- **Cloudflare Tunnel (`cloudflared`)**, instalado e disponível no `PATH`.

No Windows, instale o `cloudflared` pelo CMD com:

```cmd
winget install --id Cloudflare.cloudflared
```

Após instalar, abra um novo CMD para que ele reconheça os programas no `PATH`.

## 4. Como inicializar

Execute os comandos a partir da pasta do projeto.

### Manualmente

Em um CMD, inicie o servidor:

```cmd
go run .
```

Para testar no próprio computador, abra `http://localhost:8080`. Para criar um link de acesso pela internet, abra um segundo CMD e rode:

```cmd
cloudflared tunnel --url http://localhost:8080
```

Use o endereço `https://...trycloudflare.com` que aparecer no terminal.

### Pelo CMD usando `start.ps1`

Este comando inicia o servidor e o Tunnel juntos:

```cmd
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\start.ps1"
```

Use o link exibido no terminal e mantenha a janela aberta durante a chamada.

### Pelo executável

Para gerar `iniciar.exe`, rode uma vez no CMD:

```cmd
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\build-launcher.ps1"
```

Depois, dê dois cliques em `iniciar.exe`. O CMD exibirá o link do Tunnel; mantenha a janela aberta durante a chamada. O executável depende de `start.ps1` e dos outros arquivos do projeto na mesma pasta. Para movê-lo, copie a pasta completa. Go e `cloudflared` também precisam estar instalados e no `PATH`.
