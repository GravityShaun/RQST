import type { DjDiscoverProfile } from "@rqst/contracts";
import { apiRoutes } from "@rqst/contracts";

import { getDjImage, getVenueImage } from "./unsplash";
import { rqstApi } from "./rqst-api";

export type DiscoverDj = {
  id: number;
  artistName: string;
  slug: string;
  city?: string | null;
  genres: string[];
  imageUri: string;
  detail: string;
  isLive: boolean;
  liveSessionId?: number | null;
  venueName?: string | null;
};

export type DiscoverVenue = {
  id: number;
  name: string;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUri: string;
  detail: string;
};

export type VenueSummary = {
  id: number;
  name: string;
  address: string;
  city: string;
  state?: string | null;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
};

function routePath(route: string): string {
  return route.replace("/api/v1", "");
}

function withQuery(path: string, query?: string): string {
  const trimmed = query?.trim();
  if (!trimmed) {
    return path;
  }

  const params = new URLSearchParams({ q: trimmed });
  return `${path}?${params.toString()}`;
}

function toDiscoverDj(profile: DjDiscoverProfile): DiscoverDj {
  const genres = profile.genresJson ?? [];
  const city = profile.city?.trim() || null;
  const genreLabel = genres.slice(0, 2).join(" · ");
  const liveVenue = profile.venueName?.trim() || null;
  const detail =
    profile.isLive && liveVenue
      ? `Live now · ${liveVenue}`
      : [genreLabel, city].filter(Boolean).join(" · ") || "DJ on RQST";

  return {
    id: profile.id,
    artistName: profile.artistName,
    slug: profile.slug,
    city,
    genres,
    imageUri: getDjImage(profile.artistName),
    detail,
    isLive: profile.isLive,
    liveSessionId: profile.liveSessionId ?? null,
    venueName: liveVenue,
  };
}

function toDiscoverVenue(venue: VenueSummary): DiscoverVenue {
  const city = venue.city?.trim() || null;
  const address = venue.address?.trim() || null;
  const detail = [address, city, venue.state].filter(Boolean).join(" · ") || "Venue on RQST";

  return {
    id: venue.id,
    name: venue.name,
    city,
    address,
    latitude: venue.latitude ?? null,
    longitude: venue.longitude ?? null,
    imageUri: getVenueImage(venue.name),
    detail,
  };
}

export async function listDiscoverDjs(query?: string): Promise<DiscoverDj[]> {
  const profiles = await rqstApi<DjDiscoverProfile[]>(withQuery(routePath(apiRoutes.djs), query), { auth: false });
  return profiles.map(toDiscoverDj);
}

export async function fetchDjProfileBySlug(slug: string): Promise<DjDiscoverProfile> {
  return rqstApi<DjDiscoverProfile>(`${routePath(apiRoutes.djs)}/${encodeURIComponent(slug)}`, { auth: false });
}

export async function listDiscoverVenues(query?: string): Promise<DiscoverVenue[]> {
  const venues = await rqstApi<VenueSummary[]>(withQuery(routePath(apiRoutes.venues), query), { auth: false });
  return venues.map(toDiscoverVenue);
}
