import { nanoid } from 'nanoid';
import type { BuildUTMInput, ShortifyURLInput } from '@shared/schema';
import { sheetsService } from './sheets';

interface BuildUTMResult {
  utmId: string;
  finalURL: string;
  utmParams: {
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_term?: string;
    utm_content?: string;
  };
}

interface ShortifyResult {
  ok: boolean;
  shortURL?: string;
  error?: string;
}

export async function buildUTM(input: BuildUTMInput): Promise<BuildUTMResult> {
  try {
    const url = new URL(input.baseURL);
    
    url.searchParams.set('utm_source', input.source);
    url.searchParams.set('utm_medium', input.medium);
    url.searchParams.set('utm_campaign', input.campaign);
    
    if (input.term) {
      url.searchParams.set('utm_term', input.term);
    }
    
    if (input.content) {
      url.searchParams.set('utm_content', input.content);
    }

    const finalURL = url.toString();
    const utmId = `UTM-${nanoid(10)}`;
    const now = new Date().toISOString();

    const utmRecord = {
      UTMID: utmId,
      BaseURL: input.baseURL,
      Source: input.source,
      Medium: input.medium,
      Campaign: input.campaign,
      Term: input.term || '',
      Content: input.content || '',
      FinalURL: finalURL,
      ShortURL: '',
      CreatedTS: now,
      Notes: '',
    };

    await sheetsService.writeRows('UTM_Builder', [utmRecord]);

    await sheetsService.logToSheet(
      'INFO',
      'UTM',
      `Built UTM link: ${utmId} for campaign ${input.campaign}`
    );

    return {
      utmId,
      finalURL,
      utmParams: {
        utm_source: input.source,
        utm_medium: input.medium,
        utm_campaign: input.campaign,
        utm_term: input.term,
        utm_content: input.content,
      },
    };
  } catch (error: any) {
    await sheetsService.logToSheet(
      'ERROR',
      'UTM',
      `Build UTM failed: ${error.message}`
    );
    throw error;
  }
}

export async function shortify(input: ShortifyURLInput): Promise<ShortifyResult> {
  try {
    const records = await sheetsService.readSheet('UTM_Builder');
    const utmRecord: any = records.find((r: any) => r.UTMID === input.utmId);

    if (!utmRecord) {
      throw new Error(`UTM record ${input.utmId} not found`);
    }

    if (!utmRecord.FinalURL) {
      throw new Error(`UTM record ${input.utmId} has no FinalURL`);
    }

    const shortURL = await callLinkShortenerAPI(utmRecord.FinalURL);

    await sheetsService.updateRow('UTM_Builder', 'UTMID', input.utmId, {
      ShortURL: shortURL,
    });

    await sheetsService.logToSheet(
      'INFO',
      'UTM',
      `Shortened URL for ${input.utmId}: ${shortURL}`
    );

    return {
      ok: true,
      shortURL,
    };
  } catch (error: any) {
    await sheetsService.logToSheet(
      'ERROR',
      'UTM',
      `Shortify failed: ${error.message}`
    );
    return {
      ok: false,
      error: error.message,
    };
  }
}

async function callLinkShortenerAPI(longURL: string): Promise<string> {
  const settings = await sheetsService.readSheet('Settings');
  const providerSetting: any = settings.find((s: any) => s.Key === 'LINK_SHORTENER_PROVIDER');
  const provider = providerSetting?.Value?.toLowerCase() || 'rebrandly';

  if (provider === 'rebrandly') {
    return await shortenWithRebrandly(longURL);
  } else if (provider === 'bitly') {
    return await shortenWithBitly(longURL);
  } else if (provider === 'tinyurl') {
    return await shortenWithTinyURL(longURL);
  } else {
    throw new Error(`Unknown link shortener provider: ${provider}`);
  }
}

async function shortenWithRebrandly(longURL: string): Promise<string> {
  const apiKey = process.env.REBRANDLY_API_KEY;
  
  if (!apiKey) {
    throw new Error('REBRANDLY_API_KEY not configured in secrets');
  }

  const response = await fetch('https://api.rebrandly.com/v1/links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({
      destination: longURL,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Rebrandly API error: ${error}`);
  }

  const data = await response.json();
  return data.shortUrl || `https://${data.domainName}/${data.slashtag}`;
}

async function shortenWithBitly(longURL: string): Promise<string> {
  const apiKey = process.env.BITLY_API_KEY;
  
  if (!apiKey) {
    throw new Error('BITLY_API_KEY not configured in secrets');
  }

  const response = await fetch('https://api-ssl.bitly.com/v4/shorten', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      long_url: longURL,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bitly API error: ${error}`);
  }

  const data = await response.json();
  return data.link;
}

async function shortenWithTinyURL(longURL: string): Promise<string> {
  const apiKey = process.env.TINYURL_API_KEY;
  
  if (!apiKey) {
    throw new Error('TINYURL_API_KEY not configured in secrets');
  }

  const response = await fetch('https://api.tinyurl.com/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: longURL,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TinyURL API error: ${error}`);
  }

  const data = await response.json();
  return data.data.tiny_url;
}
