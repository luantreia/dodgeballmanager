const API_BASE_URL = process.env.REACT_APP_API_URL ?? 'https://overtime-ddyl.onrender.com/api';

type FetchMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type BodyType = BodyInit | Record<string, unknown> | null | undefined;

type RequestOptions = Omit<RequestInit, 'body'> & {
  useAuth?: boolean;
  body?: BodyType;
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
  const token = localStorage.getItem('overtime_token');

  const fetchHeaders = new Headers(headers);
  if (!(body instanceof FormData)) {
    fetchHeaders.set('Content-Type', 'application/json');
  }

  if (useAuth && token) {
    fetchHeaders.set('Authorization', `Bearer ${token}`);
  }

  const serializedBody = serializeBody(body);

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: method as FetchMethod,
    headers: fetchHeaders,
    body: serializedBody,
    ...rest,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Error al comunicarse con el servidor');
  }

  if (response.status === 204) {
    return undefined as unknown as TResponse;
  }

  return response.json() as Promise<TResponse>;
};
