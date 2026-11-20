from urllib.parse import quote

from ..utils import MatchUpdater


class UnknownCountryError(Exception):
    """Raised when the requested country is not in the countries collection."""


class VenuesUpdater:
    """Sync API-Football venues for one country into the venues collection."""

    def __init__(self):
        self.updater = MatchUpdater()
        self.collection_venues = self.updater.db['venues']
        self.collection_countries = self.updater.collection_countries

    def ensure_indexes(self):
        self.collection_venues.create_index('id', unique=True, background=True)
        self.collection_venues.create_index('country', background=True)

    def update_venues_by_country(self, country):
        """
        Fetch GET /venues?country=... and upsert by venue id.
        The venues endpoint rejects a page parameter and returns the country in one response.
        Venues already stored for this country that the API no longer returns are left in place.
        """
        country = str(country or '').strip()
        if not country:
            raise ValueError('country is required')
        if self.collection_countries.find_one({'name': country}) is None:
            raise UnknownCountryError(f'Unknown country: {country}')

        self.ensure_indexes()

        fetched = 0
        inserted = 0
        updated = 0
        skipped = 0

        endpoint = f"/venues?country={quote(country)}"
        print(f"Getting venues from API for {country}")
        payload = self.updater._make_api_request_with_retry(endpoint)
        response = payload.get('response') if isinstance(payload, dict) else None
        if not isinstance(response, list):
            raise Exception('Unexpected /venues API response shape')

        for item in response:
            outcome = self._upsert_venue(item, country)
            fetched += 1
            if outcome == 'inserted':
                inserted += 1
            elif outcome == 'updated':
                updated += 1
            else:
                skipped += 1

        print(
            f"Venues sync for {country}: fetched={fetched}, inserted={inserted}, "
            f"updated={updated}, skipped={skipped}"
        )
        return {
            'country': country,
            'fetched': fetched,
            'inserted': inserted,
            'updated': updated,
            'skipped': skipped,
        }

    def _upsert_venue(self, item, country):
        if not isinstance(item, dict):
            return 'skipped'
        venue_id = self._clean_int(item.get('id'))
        name = self._clean_text(item.get('name'))
        if venue_id is None or not name:
            return 'skipped'

        document = {
            'id': venue_id,
            'name': name,
            'address': self._clean_text(item.get('address')),
            'city': self._clean_text(item.get('city')),
            'country': country,
            'capacity': self._clean_int(item.get('capacity')),
            'surface': self._clean_text(item.get('surface')),
            'image': self._clean_text(item.get('image')),
        }
        result = self.collection_venues.update_one(
            {'id': venue_id},
            {'$set': document},
            upsert=True,
        )
        if result.upserted_id is not None:
            return 'inserted'
        return 'updated'

    def _clean_text(self, value):
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    def _clean_int(self, value):
        if value is None or value == '':
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
