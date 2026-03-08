# qr-local-http-server

A simple local HTTP server that displays a QR code for easy access from your phone or any device on the same network.

## Installation

Run directly from GitHub without installing:

```bash
npx github:florentroques/qr-local-http-server
```

## Usage

```bash
qr-local-http-server [directory] [--port=<port>]
```

### Arguments

| Argument | Default | Description |
|---|---|---|
| `directory` | `.` (current directory) | Directory to serve |
| `--port=<port>` | `8080` | Port to listen on |

### Examples

Serve the current directory on port 8080:
```bash
qr-local-http-server
```

Serve a specific directory:
```bash
qr-local-http-server ./dist
```

Serve on a custom port:
```bash
qr-local-http-server . --port=3000
```

### Output

```
  Serving: /path/to/your/directory

  Local:   http://localhost:8080
  Network: http://192.168.1.42:8080

  Scan to open on your phone:

  █▀▀▀▀▀█ ▄▀▄ █▀▀▀▀▀█
  █ ███ █ ▀█▀ █ ███ █
  ...

  Press Ctrl+C to stop.
```

Scan the QR code with your phone to instantly open the served directory in your mobile browser.

## Port conflict

If the port is already in use, the server will detect the conflicting process and offer to kill it:

```
  Port 8080 is already in use.
  Process using it: PID 12345
  Kill it and start the server? [y/N]
```

Press `y` to kill the process and start the server, or `N` to abort.

## Requirements

- Node.js >= 18
