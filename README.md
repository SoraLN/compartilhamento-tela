# La Noches

Aplicativo web para compartilhar a tela e o áudio capturado em uma sala com até cinco pessoas. Não solicita webcam nem microfone. O servidor Go serve a interface e encaminha a sinalização; a captura é enviada diretamente entre os navegadores via WebRTC.

## Rodar localmente

1. Instale Go 1.22 ou mais recente.
2. Na pasta do projeto, execute `go mod tidy` e depois `go run .`.
3. Abra `http://localhost:8080` em até cinco navegadores para testar localmente.
4. Gere um código de sala e compartilhe o convite. A primeira pessoa que entrar compartilha a tela; até quatro pessoas podem entrar como espectadoras.

O compartilhamento de tela funciona em `localhost` sem HTTPS. Ao escolher a tela, habilite a opção de compartilhar o áudio do sistema. O suporte à captura de áudio varia entre navegadores e tipos de compartilhamento; alguns oferecem apenas o áudio de uma aba.

## Acessar de outro computador

Para compartilhar uma sala pela internet, instale o **Cloudflare Tunnel (`cloudflared`) no computador que está rodando o projeto**. Ele fornece um endereço HTTPS público e encaminha a conexão até o servidor local; não é necessário abrir portas no roteador.

### Iniciar com um comando no Windows

Com Go 1.22+ e `cloudflared` instalados e disponíveis no PATH, abra o PowerShell na pasta do projeto e execute:

```powershell
.\start.ps1
```

O script inicia `go run .`, aguarda o servidor responder, inicia o Tunnel e mostra o endereço público. Deixe a janela aberta enquanto usar a chamada; `Ctrl+C` encerra os dois processos. Se o PowerShell bloquear a execução do script, use `powershell -ExecutionPolicy Bypass -File .\start.ps1`.

No Windows, instale com:

```powershell
winget install --id Cloudflare.cloudflared
```

Se preferir iniciar manualmente, mantenha o projeto rodando com `go run .` e, em outro terminal, execute:

```powershell
cloudflared tunnel --url http://localhost:8080
```

O terminal mostrará um endereço temporário `https://...trycloudflare.com`. Abra esse endereço e compartilhe o convite da sala gerado nele. O processo do Tunnel precisa continuar aberto durante a chamada; se for encerrado, o endereço para de funcionar. Para desenvolvimento e testes, o Tunnel rápido não exige conta Cloudflare. Para um endereço estável e uso permanente, configure um Tunnel nomeado seguindo a [documentação oficial do Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).

## Rede e privacidade

O áudio compartilhado e a tela são enviados diretamente entre o host e cada espectador. O servidor Go não recebe nem grava essas mídias. Como o host envia a captura separadamente para até quatro espectadores, o uso de banda de upload aumenta com o número de pessoas. A conexão usa um servidor STUN público para descoberta de rota. Algumas redes, VPNs ou firewalls bloqueiam conexões diretas; para cobertura confiável pela internet, configure um servidor TURN e adicione suas credenciais em `web/js/call.mjs`, em `iceServers`.

Este MVP permite até cinco pessoas por sala e ainda não inclui autenticação, gravação ou implantação HTTPS automática. Use códigos de sala difíceis de adivinhar ao expor o servidor publicamente.