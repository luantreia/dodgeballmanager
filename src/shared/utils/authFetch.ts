const API_BASE_URL = process.env.REACT_APP_API_URL ?? '/api';

const ACCESS_TOKEN_KEY = 'overtime_token';
const REFRESH_TOKEN_KEY = 'overtime_refresh_token';

type FetchMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type BodyType = BodyInit | Record<string, unknown> | null | undefined;

type RequestOptions = Omit<RequestInit, 'body'> & {
  useAuth?: boolean;
  body?: BodyType;
};

/**
 * Un único refresh en vuelo para toda la app. Una pantalla dispara varias llamadas en paralelo
 * (partidos + solicitudes + estadísticas), así que al vencer el access token todas daban 401 a
 * la vez y cada una arrancaba su propio refresh. Si el backend rota el refresh token, el
 * segundo intento invalida el primero y el usuario termina afuera sin haber hecho nada. Con
 * esta promesa compartida, el primero refresca y el resto espera su resultado.
 */
let refreshEnCurso: Promise<string | null> | null = null;

const refrescarToken = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const resp = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!resp.ok) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      return null;
    }

    const data = (await resp.json()) as { accessToken?: string; refreshToken?: string };
    if (data.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    return data.accessToken ?? null;
  } catch (_) {
    // Un error de red no prueba que el token sea inválido (el backend está en el plan free de
    // Render y se duerme), así que acá no se borra nada: se reintenta en la próxima llamada.
    return null;
  }
};

const refrescarTokenCompartido = (): Promise<string | null> => {
  if (!refreshEnCurso) {
    refreshEnCurso = refrescarToken().finally(() => {
      refreshEnCurso = null;
    });
  }
  return refreshEnCurso;
};

const serializeBody = (body: BodyType): BodyInit | null | undefined => {
  if (body === undefined) return undefined;
  if (body === null) return null;
  if (body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
    return body;
  }
  return JSON.stringify(body);
};

export const authFetch = async <TResponse>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<TResponse> => {
  const { useAuth = true, headers, method = 'GET', body, ...rest } = options;
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);

  const fetchHeaders = new Headers(headers);
  if (
    body !== undefined &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof Blob)
  ) {
    fetchHeaders.set('Content-Type', 'application/json');
  }

  if (useAuth && token) {
    fetchHeaders.set('Authorization', `Bearer ${token}`);
  }

  const serializedBody = serializeBody(body);

  const doRequest = async (authHeader?: string) => {
    const hdrs = new Headers(fetchHeaders);
    if (authHeader) hdrs.set('Authorization', authHeader);
    const resp = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: method as FetchMethod,
      headers: hdrs,
      body: serializedBody,
      ...rest,
    });
    return resp;
  };

  let response = await doRequest();

  if (useAuth && response.status === 401) {
    const nuevoToken = await refrescarTokenCompartido();
    if (nuevoToken) {
      response = await doRequest(`Bearer ${nuevoToken}`);
    }
  }

  if (!response.ok) {
    let message = 'Error al comunicarse con el servidor';
    let details: any = null;
    try {
      const ct = response.headers.get('Content-Type') || '';
      if (ct.includes('application/json')) {
        details = await response.json();
        message = (details && (details.message || details.error)) || message;
      } else {
        const text = await response.text();
        message = text || message;
      }
    } catch (_) {
      // ignore parse errors
    }
    const err: any = new Error(message);
    err.status = response.status;
    err.statusText = response.statusText;
    if (details) err.details = details;
    throw err;
  }

  if (response.status === 204) {
    return undefined as unknown as TResponse;
  }

  return response.json() as Promise<TResponse>;
};
