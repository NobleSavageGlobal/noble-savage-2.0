const DEFAULT_BACKEND = "http://127.0.0.1:8000";

function backendBase() {
  const configured =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_BACKEND;
  return configured.trim().replace(/\/+$/, "");
}

async function proxy(request, params) {
  const segments = Array.isArray(params?.path) ? params.path : [];
  const targetPath = segments.join("/");
  const incomingUrl = new URL(request.url);
  const targetUrl = `${backendBase()}/${targetPath}${incomingUrl.search}`;

  const bodyAllowed = !["GET", "HEAD"].includes(request.method.toUpperCase());
  const outboundHeaders = new Headers(request.headers);
  outboundHeaders.delete("host");
  outboundHeaders.delete("connection");

  const outboundBody = bodyAllowed ? await request.arrayBuffer() : undefined;
  if (bodyAllowed && outboundBody && outboundBody.byteLength === 0) {
    outboundHeaders.delete("content-length");
  }

  const targetResponse = await fetch(targetUrl, {
    method: request.method,
    headers: outboundHeaders,
    body: bodyAllowed ? outboundBody : undefined,
    redirect: "manual",
    cache: "no-store",
  });

  return new Response(targetResponse.body, {
    status: targetResponse.status,
    statusText: targetResponse.statusText,
    headers: targetResponse.headers,
  });
}

export async function GET(request, context) {
  return proxy(request, context?.params);
}

export async function POST(request, context) {
  return proxy(request, context?.params);
}

export async function PATCH(request, context) {
  return proxy(request, context?.params);
}

export async function PUT(request, context) {
  return proxy(request, context?.params);
}

export async function DELETE(request, context) {
  return proxy(request, context?.params);
}

export async function OPTIONS(request, context) {
  return proxy(request, context?.params);
}
