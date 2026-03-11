import type { EvidenceItem, SymbolProfile } from "@/lib/types";

interface KisTokenCache {
  accessToken: string;
  expiresAt: number;
}

const globalCache = globalThis as typeof globalThis & {
  __kisToken?: KisTokenCache;
};

async function getKisAccessToken() {
  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;

  if (!appKey || !appSecret) {
    return null;
  }

  const cached = globalCache.__kisToken;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }

  try {
    const response = await fetch("https://openapi.koreainvestment.com:9443/oauth2/tokenP", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: appKey,
        appsecret: appSecret
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!payload.access_token) {
      return null;
    }

    globalCache.__kisToken = {
      accessToken: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3000) * 1000 - 60_000
    };

    return payload.access_token;
  } catch {
    return null;
  }
}

export async function fetchKisEvidence(
  profile: SymbolProfile
): Promise<EvidenceItem | null> {
  if (profile.market !== "KR") {
    return null;
  }

  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;

  if (!appKey || !appSecret) {
    return null;
  }

  const accessToken = await getKisAccessToken();
  if (!accessToken) {
    return null;
  }

  const url = new URL(
    "https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price"
  );
  url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
  url.searchParams.set("FID_INPUT_ISCD", profile.symbol);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${accessToken}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: "FHKST01010100"
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      output?: {
        stck_prpr?: string;
        prdy_ctrt?: string;
        acml_vol?: string;
      };
    };

    const quote = payload.output;
    if (!quote) {
      return null;
    }

    return {
      id: `kis-${profile.symbol.toLowerCase()}`,
      source: "KIS",
      kind: "price",
      title: `${profile.name} 국내 시세`,
      url: "https://apiportal.koreainvestment.com/",
      timestamp: new Date().toISOString(),
      snippet: `국내 시세 기준 ${quote.stck_prpr ?? profile.price}원, 전일 대비 ${quote.prdy_ctrt ?? profile.changePct}%`,
      numericSnapshot: {
        price: Number(quote.stck_prpr ?? profile.price),
        changePct: Number(quote.prdy_ctrt ?? profile.changePct),
        volume: Number(quote.acml_vol ?? profile.volume)
      }
    };
  } catch {
    return null;
  }
}
