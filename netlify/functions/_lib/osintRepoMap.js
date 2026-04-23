export const OSINT_REPO_MAP = Object.freeze({
  appraisal_district: {
    label: 'County appraisal and property tax search',
    preferredProviders: ['firecrawl', 'apify', 'duckduckgo', 'github'],
    repos: [
      { slug: 'scrapy/scrapy', url: 'https://github.com/scrapy/scrapy', role: 'Structured public-record crawling patterns' },
      { slug: 'microsoft/playwright', url: 'https://github.com/microsoft/playwright', role: 'Browser automation for county property portals' },
      { slug: 'gocolly/colly', url: 'https://github.com/gocolly/colly', role: 'Fast HTML extraction for public assessor pages' }
    ],
    queryTemplates: [
      '{subject} {location} appraisal district',
      '{address} {location} property search',
      '{parcelId} {location} appraisal district',
      '{subject} {location} tax assessor'
    ]
  },
  probate: {
    label: 'Probate and estate docket search',
    preferredProviders: ['firecrawl', 'apify', 'duckduckgo', 'github'],
    repos: [
      { slug: 'scrapy/scrapy', url: 'https://github.com/scrapy/scrapy', role: 'Court index crawling patterns' },
      { slug: 'microsoft/playwright', url: 'https://github.com/microsoft/playwright', role: 'Browser workflows for probate portals' },
      { slug: 'SeleniumHQ/selenium', url: 'https://github.com/SeleniumHQ/selenium', role: 'Fallback automation for public case search portals' }
    ],
    queryTemplates: [
      '{subject} {location} probate case',
      '{subject} {location} estate docket',
      '{subject} {location} probate court',
      '{subject} {deathYear} {location} probate'
    ]
  },
  business_registry: {
    label: 'Secretary of state and entity registry search',
    preferredProviders: ['opencorporates', 'github', 'firecrawl', 'duckduckgo'],
    repos: [
      { slug: 'scrapy/scrapy', url: 'https://github.com/scrapy/scrapy', role: 'Entity registry scraping patterns' },
      { slug: 'microsoft/playwright', url: 'https://github.com/microsoft/playwright', role: 'Automation for SOS and franchise portals' },
      { slug: 'gocolly/colly', url: 'https://github.com/gocolly/colly', role: 'Fast entity lookup extraction' }
    ],
    queryTemplates: [
      '{subject} {state} secretary of state',
      '{subject} {state} entity search',
      '{subject} {state} business registry',
      '{subject} registered agent {state}'
    ]
  },
  obituary: {
    label: 'Obituary and death notice search',
    preferredProviders: ['firecrawl', 'duckduckgo', 'wikipedia', 'github'],
    repos: [
      { slug: 'scrapy/scrapy', url: 'https://github.com/scrapy/scrapy', role: 'News and obituary index crawling' },
      { slug: 'microsoft/playwright', url: 'https://github.com/microsoft/playwright', role: 'Automation for local notice sites' },
      { slug: 'ArchiveBox/ArchiveBox', url: 'https://github.com/ArchiveBox/ArchiveBox', role: 'Snapshot preservation for obituary pages' }
    ],
    queryTemplates: [
      '{subject} obituary {location}',
      '{subject} death notice {location}',
      '{subject} memorial {location}',
      '{subject} {deathYear} obituary'
    ]
  },
  people_search: {
    label: 'Open-web people search and username enumeration',
    preferredProviders: ['github', 'duckduckgo', 'firecrawl', 'reddit'],
    repos: [
      { slug: 'sherlock-project/sherlock', url: 'https://github.com/sherlock-project/sherlock', role: 'Username and profile enumeration' },
      { slug: 'p1ngul1n0/blackbird', url: 'https://github.com/p1ngul1n0/blackbird', role: 'Fast open-web account discovery' },
      { slug: 'megadose/holehe', url: 'https://github.com/megadose/holehe', role: 'Email presence checks on public services' }
    ],
    queryTemplates: [
      '{subject} {location}',
      '{subject} profile {location}',
      '{subject} alias search {location}',
      '{subject} public records {location}'
    ]
  },
  voter_files: {
    label: 'Voter file and registration signal search',
    preferredProviders: ['firecrawl', 'duckduckgo', 'github'],
    repos: [
      { slug: 'scrapy/scrapy', url: 'https://github.com/scrapy/scrapy', role: 'Public voter lookup scraping patterns' },
      { slug: 'microsoft/playwright', url: 'https://github.com/microsoft/playwright', role: 'Automation for state voter portals' },
      { slug: 'SeleniumHQ/selenium', url: 'https://github.com/SeleniumHQ/selenium', role: 'Fallback browser automation for public voter sites' }
    ],
    queryTemplates: [
      '{subject} voter registration {state}',
      '{subject} voter file {location}',
      '{subject} precinct {location}',
      '{subject} registered voter {state}'
    ]
  },
  code_enforcement: {
    label: 'Code enforcement and municipal violation search',
    preferredProviders: ['firecrawl', 'duckduckgo', 'github'],
    repos: [
      { slug: 'scrapy/scrapy', url: 'https://github.com/scrapy/scrapy', role: 'Municipal records crawling patterns' },
      { slug: 'microsoft/playwright', url: 'https://github.com/microsoft/playwright', role: 'Automation for city code-enforcement portals' },
      { slug: 'gocolly/colly', url: 'https://github.com/gocolly/colly', role: 'Fast extraction for municipal notice pages' }
    ],
    queryTemplates: [
      '{address} {location} code enforcement',
      '{address} {location} violations',
      '{subject} {location} nuisance case',
      '{address} municipal citation {location}'
    ]
  },
  jail: {
    label: 'Jail roster and inmate locator search',
    preferredProviders: ['firecrawl', 'duckduckgo', 'github'],
    repos: [
      { slug: 'scrapy/scrapy', url: 'https://github.com/scrapy/scrapy', role: 'Roster crawling patterns' },
      { slug: 'microsoft/playwright', url: 'https://github.com/microsoft/playwright', role: 'Automation for sheriff inmate portals' },
      { slug: 'SeleniumHQ/selenium', url: 'https://github.com/SeleniumHQ/selenium', role: 'Fallback browser automation for custody search sites' }
    ],
    queryTemplates: [
      '{subject} {location} jail roster',
      '{subject} {location} inmate locator',
      '{subject} sheriff custody {location}',
      '{subject} booking {location}'
    ]
  },
  archived_snapshots: {
    label: 'Archived snapshots and historical page recovery',
    preferredProviders: ['github', 'firecrawl', 'wikipedia', 'duckduckgo'],
    repos: [
      { slug: 'akamhy/waybackpy', url: 'https://github.com/akamhy/waybackpy', role: 'Wayback Machine access patterns' },
      { slug: 'ArchiveBox/ArchiveBox', url: 'https://github.com/ArchiveBox/ArchiveBox', role: 'Historical capture and replay workflows' },
      { slug: 'microsoft/playwright', url: 'https://github.com/microsoft/playwright', role: 'Snapshot validation in browser automation flows' }
    ],
    queryTemplates: [
      '{subject} {location} site:archive.org',
      '{address} {location} archived',
      '{subject} historic records {location}',
      '{subject} older version {location}'
    ]
  }
});

export function getOsintCategoryConfig(categoryId) {
  return OSINT_REPO_MAP[String(categoryId || '').trim()] || null;
}
