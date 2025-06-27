// src/lib/browsingUtils.ts

export const REMOTE_SITE_ID_MARKER = "remote@";

export interface ParsedSiteIdentifier {
  rawParam: string;          // The original parameter from the URL
  cleanedIdOrUrl: string;  // The ID after basic cleaning (quotes, one layer of URI decode)
  isRemote: boolean;
  remoteBaseUrl: string | null; // Decoded and validated base URL if remote
  effectiveSiteId: string;     // The ID to use for fetching/internal logic (e.g. "actual-id" or "remote@actual-id")
}

/**
 * Parses the site identifier from URL parameters, handles decoding,
 * and determines if it's a local or remote site.
 * 
 * @param siteIdParam The raw siteId parameter from Next.js `useParams()`.
 * @returns ParsedSiteIdentifier object or null if siteIdParam is invalid.
 */
export function parseSiteIdentifier(siteIdParam: string | string[] | undefined): ParsedSiteIdentifier | null {
  let rawId = '';
  if (Array.isArray(siteIdParam)) {
    rawId = siteIdParam[0] || '';
  } else if (typeof siteIdParam === 'string') {
    rawId = siteIdParam;
  }

  if (!rawId) {
    console.warn("[BrowsingUtils] siteIdParam is empty or undefined.");
    return null;
  }

  let cleanedId = rawId;

  // Attempt to decode (browsers/Next.js might already do one layer)
  try {
    let decodedOnce = decodeURIComponent(cleanedId);
    // Heuristic: if it still contains '%', it might be double-encoded, especially if wrapped in quotes.
    if (decodedOnce.includes('%') && (decodedOnce.startsWith('"') || decodedOnce.startsWith('%22'))) {
        let temp = decodedOnce;
        if (temp.startsWith('%22')) temp = temp.substring(3); // Remove leading %22
        if (temp.endsWith('%22')) temp = temp.substring(0, temp.length - 3); // Remove trailing %22
        if (temp.startsWith('"')) temp = temp.substring(1); // Remove leading "
        if (temp.endsWith('"')) temp = temp.substring(0, temp.length - 1); // Remove trailing "
        decodedOnce = decodeURIComponent(temp);
    }
    cleanedId = decodedOnce;
  } catch (e) {
    console.warn(`[BrowsingUtils] decodeURIComponent failed for "${cleanedId}", using as is. Error:`, e);
  }

  // Final removal of surrounding quotes if present
  if (cleanedId.startsWith('"') && cleanedId.endsWith('"')) {
    cleanedId = cleanedId.substring(1, cleanedId.length - 1);
  }
  
  const isRemote = cleanedId.startsWith(REMOTE_SITE_ID_MARKER);
  let remoteBaseUrl: string | null = null;
  const effectiveSiteId = cleanedId; // For local sites, cleanedId is the effectiveSiteId

  if (isRemote) {
    const potentialUrl = cleanedId.substring(REMOTE_SITE_ID_MARKER.length);
    try {
      // The URL part should already be decoded by the steps above.
      // We just need to validate it's a URL.
      const urlObject = new URL(potentialUrl);
      remoteBaseUrl = urlObject.origin; // Use origin (scheme + hostname + port)
      // For remote sites, the cleanedId itself (e.g., "remote@http://...") is used as the key/identifier
      // for display and routing, but the actual ID fetched from manifest is what `LocalSiteData.siteId` will hold.
      // Let's keep `effectiveSiteId` as the full "remote@..." string for consistency in what the client uses
      // to identify this browsing session. The fetcher will derive the internal siteId.
    } catch (e) {
      console.error(`[BrowsingUtils] Invalid remote URL part: "${potentialUrl}" from "${cleanedId}"`, e);
      return { // Return a partial result indicating parsing failure for remote URL
          rawParam: rawId,
          cleanedIdOrUrl: cleanedId,
          isRemote: true,
          remoteBaseUrl: null, // Explicitly null due to error
          effectiveSiteId: cleanedId,
      }; 
    }
  }

  return {
    rawParam: rawId,
    cleanedIdOrUrl: cleanedId,
    isRemote,
    remoteBaseUrl,
    effectiveSiteId,
  };
}