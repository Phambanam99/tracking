"""
VesselFinder data source implementation.
Scrapes vessel information from VesselFinder public website.
"""

import asyncio
import re
from typing import Optional
from bs4 import BeautifulSoup
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.schemas.vessel import VesselEnrichmentData
from app.data_sources.base import VesselDataSource
from app.logging_config import log_async_function_call


class VesselFinderScraper(VesselDataSource):
    """
    VesselFinder public data scraper.
    Uses publicly available information from VesselFinder website.
    Implements conservative rate limiting to avoid IP blocking.
    """
    
    def __init__(self):
        super().__init__(
            name="VesselFinder",
            priority=1,
            rate_limit=settings.vesselfinder_rate_limit
        )
        self.base_url = "https://www.vesselfinder.com"
        self.timeout = settings.vesselfinder_timeout_seconds
        
        # HTTP client configuration
        self.client_config = {
            "headers": {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": self.base_url,
            },
            "timeout": httpx.Timeout(self.timeout),
            "follow_redirects": True,
        }
    
    @log_async_function_call
    async def fetch_by_mmsi(self, mmsi: str) -> Optional[VesselEnrichmentData]:
        """
        Fetch vessel information by MMSI from VesselFinder.
        
        Args:
            mmsi: Maritime Mobile Service Identity
            
        Returns:
            VesselEnrichmentData if found, None otherwise
        """
        try:
            # Respect rate limiting
            await self.respect_rate_limit()
            
            # Apply exponential backoff if needed
            backoff_delay = await self.get_backoff_delay()
            if backoff_delay > 0:
                import structlog
                logger = structlog.get_logger(self.__class__.__name__)
                logger.warning(
                    "applying_backoff_delay",
                    source=self.name,
                    mmsi=mmsi,
                    delay_seconds=backoff_delay,
                    consecutive_errors=self.consecutive_errors,
                )
                await asyncio.sleep(backoff_delay)
            
            # Fetch vessel details page
            url = f"{self.base_url}/vessels/details/{mmsi}"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, **self.client_config)
                
                if response.status_code == 404:
                    # Vessel not found
                    self.reset_error_counter()
                    return None
                
                if response.status_code in [406, 429]:
                    # Rate limited or blocked
                    self.handle_error(Exception(f"HTTP {response.status_code} - Rate limited"))
                    return None
                
                if not response.ok:
                    self.handle_error(Exception(f"HTTP {response.status_code}"))
                    return None
                
                # Parse HTML response
                html = response.text
                vessel_data = self._parse_vessel_finder_html(html, mmsi)
                
                if vessel_data:
                    self.reset_error_counter()
                    return vessel_data
                else:
                    return None
                    
        except Exception as e:
            self.handle_error(e)
            return None
    
    @log_async_function_call
    async def is_available(self) -> bool:
        """
        Check if VesselFinder is available.
        
        Returns:
            True if available, False otherwise
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.head(
                    self.base_url,
                    timeout=httpx.Timeout(5.0),
                    headers=self.client_config["headers"]
                )
                return response.ok
        except Exception:
            return False
    
    def _parse_vessel_finder_html(self, html: str, mmsi: str) -> Optional[VesselEnrichmentData]:
        """
        Parse HTML response from VesselFinder details page.
        
        Args:
            html: HTML content from VesselFinder
            mmsi: MMSI being searched for
            
        Returns:
            Parsed vessel data or None if parsing failed
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract vessel name from h1 title
            title_element = soup.find('h1', class_='title')
            if not title_element:
                return None
            
            vessel_name = title_element.get_text(strip=True)
            if not vessel_name:
                return None
            
            # Initialize vessel data
            vessel_data = {
                'mmsi': mmsi,
                'vessel_name': vessel_name,
            }
            
            # Extract information from table rows
            table_rows = soup.find_all('tr')
            for row in table_rows:
                cells = row.find_all('td')
                if len(cells) >= 2:
                    label = cells[0].get_text(strip=True).lower()
                    value = cells[1].get_text(strip=True)
                    
                    if not value or value == '-':
                        continue
                    
                    # Map table labels to vessel data fields
                    if 'imo' in label and 'number' in label:
                        vessel_data['imo'] = value
                    elif 'callsign' in label:
                        vessel_data['call_sign'] = value
                    elif 'flag' in label:
                        vessel_data['flag'] = value
                    elif 'year of build' in label:
                        year_match = re.search(r'\d{4}', value)
                        if year_match:
                            vessel_data['year_built'] = int(year_match.group())
                    elif 'length overall' in label:
                        length_match = re.search(r'[\d.]+', value)
                        if length_match:
                            vessel_data['length'] = int(float(length_match.group()))
                    elif 'beam' in label:
                        beam_match = re.search(r'[\d.]+', value)
                        if beam_match:
                            vessel_data['width'] = float(beam_match.group())
                    elif 'gross tonnage' in label:
                        tonnage_match = re.search(r'\d+', value)
                        if tonnage_match:
                            vessel_data['gross_tonnage'] = int(tonnage_match.group())
            
            # Extract vessel type from h2 element
            vessel_type_element = soup.find('h2', class_='vst')
            if vessel_type_element:
                vessel_type = vessel_type_element.get_text(strip=True)
                vessel_data['vessel_type'] = vessel_type.split(',')[0] if vessel_type else None
            
            # Extract destination from route information
            route_text = soup.get_text()
            dest_match = re.search(r'en route to\s*<strong>([^<]+)</strong>', route_text, re.IGNORECASE)
            if dest_match:
                vessel_data['destination'] = dest_match.group(1).strip()
            
            # Calculate quality score
            vessel_data['data_quality_score'] = self.calculate_quality_score(vessel_data)
            
            # Create VesselEnrichmentData object
            return VesselEnrichmentData(**vessel_data)
            
        except Exception as e:
            import structlog
            logger = structlog.get_logger(self.__class__.__name__)
            logger.error(
                "html_parsing_failed",
                mmsi=mmsi,
                error=str(e),
                error_type=type(e).__name__,
            )
            return None
    
    def _extract_field_value(self, text: str, pattern: str) -> Optional[str]:
        """
        Extract field value using regex pattern.
        
        Args:
            text: Text to search in
            pattern: Regex pattern
            
        Returns:
            Extracted value or None
        """
        match = re.search(pattern, text, re.IGNORECASE)
        return match.group(1).strip() if match else None