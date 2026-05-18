type HeaderValue = string | string[] | undefined;

type NodeLikeRequest = {
  method?: string;
  url?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
  on?: (event: string, callback: (chunk?: unknown) => void) => void;
};

type NodeLikeResponse = {
  status: (code: number) => NodeLikeResponse;
  setHeader: (name: string, value: string) => void;
  send: (body: Buffer | string) => void;
  end: () => void;
};

function normalizeHeaders(headers: Record<string, HeaderValue>): Headers {
  const out = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") out.set(key, value);
    else if (Array.isArray(value)) out.set(key, value.join(", "));
  }
  return out;
}

async function readRequestBody(req: NodeLikeRequest): Promise<BodyInit | undefined> {
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;
  if (req.body !== undefined) {
    if (typeof req.body === "string") return req.body;
    if (req.body instanceof Buffer) return new Uint8Array(req.body);
    return JSON.stringify(req.body);
  }
  if (!req.on) return undefined;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on?.("data", (chunk) => {
      if (typeof chunk === "string" || chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk));
    });
    req.on?.("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    req.on?.("error", (error) => reject(error));
  });
}

export async function toWebRequest(req: NodeLikeRequest): Promise<Request> {
  const proto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(proto) ? proto[0] : proto ?? "https";
  const host = req.headers.host;
  const hostname = Array.isArray(host) ? host[0] : host ?? "localhost";
  return new Request(`${protocol}://${hostname}${req.url ?? "/"}`, {
    method: req.method ?? "GET",
    headers: normalizeHeaders(req.headers),
    body: await readRequestBody(req),
  });
}

export async function sendWebResponse(res: NodeLikeResponse, response: Response) {
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.status(response.status);
  if (response.status === 204) return res.end();
  res.send(Buffer.from(await response.arrayBuffer()));
}