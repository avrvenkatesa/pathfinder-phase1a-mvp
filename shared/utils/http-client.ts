// HTTP client for inter-service communication
interface ServiceConfig {
  baseUrl: string;
  timeout: number;
}

interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  headers?: Record<string, string>;
}

export class HttpClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: ServiceConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout;
  }

  async request<T = any>(config: RequestConfig): Promise<T> {
    const url = `${this.baseUrl}${config.url}`;
    
    const fetchConfig: RequestInit = {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      signal: AbortSignal.timeout(this.timeout),
    };

    if (config.data) {
      fetchConfig.body = JSON.stringify(config.data);
    }

    try {
      const response = await fetch(url, fetchConfig);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Service request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'GET', url, headers });
  }

  post<T>(url: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'POST', url, data, headers });
  }

  put<T>(url: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'PUT', url, data, headers });
  }

  delete<T>(url: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'DELETE', url, headers });
  }

  patch<T>(url: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'PATCH', url, data, headers });
  }
}