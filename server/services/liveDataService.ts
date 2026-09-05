import { logger } from '../utils/logger';

export interface WeatherData {
  city: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  sourceUrl: string;
}

export interface NewsItem {
  title: string;
  source: string;
  link: string;
  pubDate?: string;
}

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  sourceUrl: string;
}

export class LiveDataService {
  /**
   * Weather condition interpreter from WMO weather codes
   */
  private interpretWeatherCode(code: number): string {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 55) return 'Light drizzle';
    if (code >= 61 && code <= 65) return 'Rain showers';
    if (code >= 71 && code <= 75) return 'Snow fall';
    if (code >= 80 && code <= 82) return 'Rain showers';
    if (code >= 95) return 'Thunderstorm';
    return 'Partly cloudy';
  }

  /**
   * Fetch current real-time weather from Open-Meteo
   */
  async getWeather(options?: {
    latitude?: number;
    longitude?: number;
    city?: string;
  }): Promise<{ success: boolean; data?: WeatherData; needLocation?: boolean; error?: string }> {
    try {
      let lat = options?.latitude;
      let lon = options?.longitude;
      let cityName = options?.city;

      // If city is provided, resolve coordinates via geocoding
      if (cityName && (!lat || !lon)) {
        try {
          const geoRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`
          );
          const geoData = await geoRes.json();
          if (geoData.results && geoData.results.length > 0) {
            lat = geoData.results[0].latitude;
            lon = geoData.results[0].longitude;
            cityName = `${geoData.results[0].name}, ${geoData.results[0].country || ''}`.trim().replace(/,\s*$/, '');
          }
        } catch (e: any) {
          logger.warn('Geocoding error for city', { city: cityName, error: e?.message });
        }
      }

      // If still no coordinates and no city, prompt for location
      if (!lat || !lon) {
        return { success: false, needLocation: true };
      }

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
      const res = await fetch(weatherUrl);
      if (!res.ok) {
        throw new Error(`Open-Meteo API returned status ${res.status}`);
      }

      const json = await res.json();
      const current = json.current;
      if (!current) {
        throw new Error('No current weather payload returned.');
      }

      const data: WeatherData = {
        city: cityName || 'your current location',
        temperature: Math.round(current.temperature_2m * 10) / 10,
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m * 10) / 10,
        condition: this.interpretWeatherCode(current.weather_code),
        sourceUrl: `https://open-meteo.com/en/docs`,
      };

      return { success: true, data };
    } catch (err: any) {
      logger.error('Failed to retrieve live weather data', { error: err?.message });
      return { success: false, error: 'Unable to fetch current weather.' };
    }
  }

  /**
   * Fetch real-time news headlines from Google News RSS
   */
  async getNews(query?: string): Promise<{ success: boolean; items: NewsItem[] }> {
    try {
      let url = 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en';
      if (query && query.trim() !== '') {
        url = `https://news.google.com/rss/search?q=${encodeURIComponent(query.trim())}&hl=en-IN&gl=IN&ceid=IN:en`;
      }

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      });

      if (!res.ok) {
        throw new Error(`Google News RSS returned ${res.status}`);
      }

      const xml = await res.text();
      const items: NewsItem[] = [];

      // Extract items via regex
      const itemBlocks = xml.split('<item>');
      for (let i = 1; i < Math.min(itemBlocks.length, 6); i++) {
        const block = itemBlocks[i];
        const titleMatch = block.match(/<title>(.*?)<\/title>/);
        const linkMatch = block.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);
        const sourceMatch = block.match(/<source[^>]*>(.*?)<\/source>/);

        if (titleMatch && titleMatch[1]) {
          const rawTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
          const link = linkMatch ? linkMatch[1].trim() : 'https://news.google.com';
          const source = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : 'News Source';

          items.push({
            title: rawTitle,
            source,
            link,
            pubDate: pubDateMatch ? pubDateMatch[1] : undefined,
          });
        }
      }

      return { success: true, items };
    } catch (err: any) {
      logger.error('Failed to retrieve live news', { error: err?.message });
      return { success: false, items: [] };
    }
  }

  /**
   * Fetch live stock and index data from Yahoo Finance
   */
  async getStock(query: string): Promise<{ success: boolean; data?: StockData; error?: string }> {
    try {
      const q = query.toLowerCase().trim();
      let ticker = '';
      let companyName = query;

      if (q.includes('reliance')) {
        ticker = 'RELIANCE.NS';
        companyName = 'Reliance Industries';
      } else if (q.includes('tcs') || q.includes('tata consultancy')) {
        ticker = 'TCS.NS';
        companyName = 'Tata Consultancy Services';
      } else if (q.includes('infosys')) {
        ticker = 'INFY.NS';
        companyName = 'Infosys';
      } else if (q.includes('hdfc')) {
        ticker = 'HDFCBANK.NS';
        companyName = 'HDFC Bank';
      } else if (q.includes('sensex') || q.includes('bse')) {
        ticker = '^BSESN';
        companyName = 'BSE SENSEX';
      } else if (q.includes('nifty') || q.includes('nse')) {
        ticker = '^NSEI';
        companyName = 'NIFTY 50';
      } else if (q.includes('apple')) {
        ticker = 'AAPL';
        companyName = 'Apple Inc.';
      } else if (q.includes('google') || q.includes('alphabet')) {
        ticker = 'GOOGL';
        companyName = 'Alphabet Inc.';
      } else if (q.includes('tesla')) {
        ticker = 'TSLA';
        companyName = 'Tesla Inc.';
      } else if (q.includes('microsoft')) {
        ticker = 'MSFT';
        companyName = 'Microsoft Corp.';
      } else {
        // Default market health to NIFTY 50 and SENSEX if generic market question
        if (q.includes('stock market') || q.includes('market today') || q.includes('stocks')) {
          ticker = '^NSEI';
          companyName = 'NIFTY 50';
        } else {
          // Attempt ticker search
          const cleanedTicker = query.replace(/[^a-zA-Z0-9.-]/g, '').toUpperCase();
          ticker = cleanedTicker.endsWith('.NS') ? cleanedTicker : `${cleanedTicker}.NS`;
          companyName = cleanedTicker;
        }
      }

      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });

      if (!res.ok) {
        throw new Error(`Yahoo Finance API returned ${res.status}`);
      }

      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      if (!meta || meta.regularMarketPrice === undefined) {
        throw new Error('No price data found for ticker.');
      }

      const price = meta.regularMarketPrice;
      const prevClose = meta.previousClose || meta.chartPreviousClose || price;
      const change = Math.round((price - prevClose) * 100) / 100;
      const changePercent = Math.round(((price - prevClose) / prevClose) * 10000) / 100;

      const data: StockData = {
        symbol: meta.symbol || ticker,
        name: companyName,
        price: Math.round(price * 100) / 100,
        currency: meta.currency || 'INR',
        change,
        changePercent,
        sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}`,
      };

      return { success: true, data };
    } catch (err: any) {
      logger.error('Failed to retrieve live stock data', { error: err?.message, query });
      return { success: false, error: 'Unable to fetch current market price.' };
    }
  }
}

export const liveDataService = new LiveDataService();
