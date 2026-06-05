import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import * as https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchConfig {
  apiKey?: string;
  timeout: number;
}

interface SearchProvider {
  name: string;
  search(query: string, config: SearchConfig): Promise<SearchResult[]>;
}

// ═════════════════════════════════════════════════════════════════════
// DuckDuckGo HTML scraping provider — free, no API key
// ═════════════════════════════════════════════════════════════════════

function httpGet(url: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || '';
    const u = new URL(url);
    const opts: any = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      },
    };
    if (proxyUrl) opts.agent = new HttpsProxyAgent(proxyUrl);
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(d));
    });
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

const ddgProvider: SearchProvider = {
  name: 'ddg',
  async search(query: string, config: SearchConfig): Promise<SearchResult[]> {
    const q = encodeURIComponent(query);
    const html = await httpGet(`https://html.duckduckgo.com/html/?q=${q}`, config.timeout);
    const results: SearchResult[] = [];
    // DDG HTML structure (2026): result__title contains result__a (link) + result__snippet
    const titleBlocks = html.split('class="result__title"');
    for (let i = 1; i < titleBlocks.length && results.length < 5; i++) {
      const b = titleBlocks[i];
      const aMatch = b.match(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      if (aMatch) {
        let url = aMatch[1];
        // DDG redirect URL — extract real URL from uddg param
        const uddg = url.match(/uddg=([^&]*)/);
        if (uddg) url = decodeURIComponent(uddg[1]);
        if (url.startsWith('//')) url = 'https:' + url;
        results.push({
          title: aMatch[2].replace(/<[^>]*>/g, '').trim(),
          url,
          snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '',
        });
      }
    }
    return results;
  },
};

// ═════════════════════════════════════════════════════════════════════
// Bing Web Search API v7 — free tier: 3000 req/month, 1 req/sec
// ═════════════════════════════════════════════════════════════════════

const bingProvider: SearchProvider = {
  name: 'bing',
  async search(query: string, config: SearchConfig): Promise<SearchResult[]> {
    if (!config.apiKey) throw new Error('Bing API key not configured');
    const q = encodeURIComponent(query);
    const res = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${q}&count=5&mkt=zh-CN`, {
      headers: {
        'Ocp-Apim-Subscription-Key': config.apiKey,
      },
      signal: AbortSignal.timeout(config.timeout),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Bing API ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const webPages = data?.webPages?.value || [];
    return webPages.map((p: any) => ({
      title: p.name || '',
      url: p.url || '',
      snippet: p.snippet || '',
    }));
  },
};

// ═════════════════════════════════════════════════════════════════════

const PROVIDERS: Record<string, SearchProvider> = {
  ddg: ddgProvider,
  bing: bingProvider,
};

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Execute a web search using the configured provider.
   * Returns empty array if search is disabled or fails.
   */
  async search(query: string, userId: string): Promise<SearchResult[]> {
    const providerName = (await this.settingsService.get('web_search_provider', userId)) || 'ddg';
    const apiKey = await this.settingsService.get('web_search_api_key', userId);
    const provider = PROVIDERS[providerName] || ddgProvider;

    const timeout = providerName === 'ddg' ? 15000 : 5000;
    const config: SearchConfig = { apiKey: apiKey || undefined, timeout };

    this.logger.log(
      `[search] provider=${provider.name} query="${query.slice(0, 60)}" timeout=${timeout}ms`,
    );
    const t0 = Date.now();

    try {
      const results = await provider.search(query, config);
      this.logger.log(`[search] done results=${results.length} took=${Date.now() - t0}ms`);
      return results;
    } catch (e: any) {
      this.logger.warn(
        `[search] failed provider=${provider.name} error="${e.message?.slice(0, 120)}" took=${Date.now() - t0}ms`,
      );
      return [];
    }
  }

  /**
   * Format search results into an LLM system message.
   */
  formatSystemMessage(results: SearchResult[]): string {
    if (results.length === 0) {
      return '[Web Search Results] — Search returned no results or failed. Answer from your own knowledge.';
    }
    return (
      "[Web Search Results] — Use these real-time search results to answer the user's question. Cite sources by their [N] number.\n\n" +
      results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n')
    );
  }
}
