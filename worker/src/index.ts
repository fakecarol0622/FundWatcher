interface Env {
  ALLOWED_ORIGIN?: string;
}

const SERVICE_NAME = "fund-watcher-worker";
const ALLOWED_METHODS = "GET, POST, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization";

function getCorsHeaders(env: Env): HeadersInit {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  };
}

function jsonResponse(
  body: unknown,
  env: Env,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...getCorsHeaders(env),
      ...init.headers,
    },
  });
}

function handleOptions(env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(env),
  });
}

function handleHealth(request: Request, env: Env): Response {
  if (request.method !== "GET") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      env,
      { status: 405 },
    );
  }

  return jsonResponse(
    {
      ok: true,
      service: SERVICE_NAME,
      time: new Date().toISOString(),
    },
    env,
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return handleOptions(env);
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return handleHealth(request, env);
    }

    return jsonResponse(
      { ok: false, error: "Not found" },
      env,
      { status: 404 },
    );
  },
};
