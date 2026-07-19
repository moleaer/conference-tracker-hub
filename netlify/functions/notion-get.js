const https = require('https');

const NOTION_KEY = process.env.NOTION_KEY;
const DB_CONFERENCES = process.env.NOTION_DB_CONFERENCES;

function notionRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.notion.com', path, method,
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error(raw)); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function prop(page, name) {
  const p = page.properties?.[name];
  if (!p) return null;
  switch (p.type) {
    case 'title': return p.title?.[0]?.plain_text || '';
    case 'rich_text': return p.rich_text?.[0]?.plain_text || '';
    case 'select': return p.select?.name || '';
    case 'multi_select': return (p.multi_select || []).map(o => o.name);
    case 'date': return p.date?.start || '';
    case 'checkbox': return p.checkbox || false;
    case 'number': return p.number ?? null;
    case 'url': return p.url || '';
    default: return null;
  }
}

// Paginate through all results (Notion caps a single query at 100)
async function queryAll(databaseId, body = {}) {
  let results = [];
  let cursor = undefined;
  do {
    const res = await notionRequest('POST', `/v1/databases/${databaseId}/query`,
      { ...body, ...(cursor ? { start_cursor: cursor } : {}) });
    if (res.object === 'error') throw new Error(res.message);
    results = results.concat(res.results || []);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const pages = await queryAll(DB_CONFERENCES, {
      sorts: [{ property: 'Deadline', direction: 'ascending' }],
    });

    const conferences = pages.map(p => ({
      id: p.id,
      notionId: p.id,
      fullName: prop(p, 'Name'),
      shortName: prop(p, 'Short Name'),
      year: prop(p, 'Year'),
      region: prop(p, 'Region'),
      deadline: prop(p, 'Deadline'),
      confDates: prop(p, 'Conf Dates'),
      city: prop(p, 'City'),
      state: prop(p, 'State'),
      country: prop(p, 'Country'),
      venue: prop(p, 'Venue'),
      cfaUrl: prop(p, 'CFA URL'),
      website: prop(p, 'Website'),
      notes: prop(p, 'Notes'),
      status: prop(p, 'Status'),
      techPaper: prop(p, 'Tech Paper'),
      paperDeadline: prop(p, 'Paper Deadline'),
      presenter: prop(p, 'Presenter'),
      presDetails: prop(p, 'Presentation Details'),
      cats: prop(p, 'Categories'),
      pursueNextYear: prop(p, 'Pursue Next Year'),
      lastEdited: p.last_edited_time,
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ conferences }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
