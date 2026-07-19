const https = require('https');

const NOTION_KEY = process.env.NOTION_KEY;
const DB_CONFERENCES = process.env.NOTION_DB_CONFERENCES;

const STATUS_OPTIONS = [
  { name: 'monitoring', color: 'gray' },
  { name: 'planning', color: 'blue' },
  { name: 'submitted', color: 'yellow' },
  { name: 'accepted', color: 'green' },
  { name: 'rejected', color: 'red' },
  { name: 'ready', color: 'purple' },
  { name: 'complete', color: 'green' },
  { name: 'withdrawn', color: 'orange' },
  { name: 'pass', color: 'default' },
];
const REGION_OPTIONS = ['US', 'EUR', 'APAC', 'LATAM', 'GLOBAL'].map(name => ({ name }));
const CATEGORY_OPTIONS = ['muni', 'ind', 'pre', 'dew'].map(name => ({ name }));
const YEAR_OPTIONS = ['2026', '2027', '2028'].map(name => ({ name }));
const PURSUE_OPTIONS = ['yes', 'no', 'maybe'].map(name => ({ name }));

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

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const result = await notionRequest('PATCH', `/v1/databases/${DB_CONFERENCES}`, {
      properties: {
        'Status': { select: { options: STATUS_OPTIONS } },
        'Region': { select: { options: REGION_OPTIONS } },
        'Categories': { multi_select: { options: CATEGORY_OPTIONS } },
        'Year': { select: { options: YEAR_OPTIONS } },
        'Pursue Next Year': { select: { options: PURSUE_OPTIONS } },
      },
    });

    const ok = result.object !== 'error';
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: ok, message: ok ? 'Select options configured' : result.message }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
