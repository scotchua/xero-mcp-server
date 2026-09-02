import http from "http";

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head><title>Xero Authorization</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px;">
  <h1>Authorization Successful</h1>
  <p>You can close this tab and return to your terminal.</p>
</body>
</html>`;

/**
 * Temporary local HTTP server that catches the OAuth2 redirect during the
 * auth-code flow, so the CLI doesn't need a public callback URL.
 */
export class OAuthCallbackServer {
  private readonly port: number;
  private server: http.Server | null = null;

  constructor(port: number = 3000) {
    this.port = port;
  }

  /**
   * Starts the server and waits for the OAuth callback. Returns the full
   * callback URL including query parameters.
   */
  waitForCallback(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.shutdown();
        reject(
          new Error(
            "Authorization timed out after 5 minutes. Please try again.",
          ),
        );
      }, TIMEOUT_MS);

      this.server = http.createServer((req, res) => {
        if (req.url?.startsWith("/callback")) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(SUCCESS_HTML);

          clearTimeout(timeout);
          const callbackUrl = `http://localhost:${this.port}${req.url}`;

          // Shut down after a brief delay to ensure the response is sent.
          setTimeout(() => {
            this.shutdown();
            resolve(callbackUrl);
          }, 500);
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
        }
      });

      this.server.on("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timeout);
        if (err.code === "EADDRINUSE") {
          reject(
            new Error(
              `Port ${this.port} is already in use. Set XERO_CALLBACK_PORT to a different port.`,
            ),
          );
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, "localhost", () => {
        process.stderr.write(
          `[Xero Auth] Callback server listening on http://localhost:${this.port}/callback\n`,
        );
      });
    });
  }

  shutdown(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
