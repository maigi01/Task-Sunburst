// ═══════════════════════════════════════════════════════════════
//  GRAPH  –  schlanker Client für die Microsoft-Graph-API
//
//  Wird von source/todo.js und configStore/todoTask.js gemeinsam genutzt.
// ═══════════════════════════════════════════════════════════════

const BASE_URL = 'https://graph.microsoft.com/v1.0';
const MAX_RETRIES = 3;

export class GraphError extends Error {
  constructor(status, code, message) {
    super(`Graph-API ${status}${code ? ` (${code})` : ''}: ${message}`);
    this.status = status;
    this.code = code;
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export function createGraphClient(getToken, fetchFn = (...args) => fetch(...args)) {
  async function request(method, path, body) {
    const url = path.startsWith('https://') ? path : BASE_URL + path;
    for (let attempt = 0; ; attempt++) {
      const res = await fetchFn(url, {
        method,
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      // Drosselung: Retry-After beachten
      if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
        const seconds = Number(res.headers.get('Retry-After')) || 2 ** attempt;
        await wait(seconds * 1000);
        continue;
      }
      if (res.status === 204) return null;

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new GraphError(res.status, data?.error?.code, data?.error?.message ?? res.statusText);
      }
      return data;
    }
  }

  return {
    get:   path => request('GET', path),
    post:  (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),

    // Alle Seiten einer Collection über @odata.nextLink lesen
    async getAll(path) {
      const items = [];
      let next = path;
      while (next) {
        const page = await request('GET', next);
        items.push(...(page.value ?? []));
        next = page['@odata.nextLink'];
      }
      return items;
    },
  };
}
