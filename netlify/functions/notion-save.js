const https = require('https');

const NOTION_KEY = process.env.NOTION_KEY;
const DB_CONFERENCES = process.env.NOTION_DB_CONFERENCES;

function notionRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'api.notion.com', path, method,
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error(raw)); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function ttl(v) { return { title: [{ text: { content: v || '' } }] }; }
function txt(v) { return { rich_text: [{ text: { content: v || '' } }] }; }
function sel(v) { return { select: v ? { name: v } : null }; }
function msel(v) { return { multi_select: (v || []).map(name => ({ name })) }; }
function dt(v) { return { date: v ? { start: v } : null }; }
function chk(v) { return { checkbox: !!v }; }
function urlProp(v) { return { url: v || null }; }

function buildProps(data) {
  const props = {};
  if (data.fullName !== undefined) props['Name'] = ttl(data.fullName);
  if (data.shortName !== undefined) props['Short Name'] = txt(data.shortName);
  if (data.year !== undefined) props['Year'] = sel(data.year);
  if (data.region !== undefined) props['Region'] = sel(data.region);
  if (data.deadline !== undefined) props['Deadline'] = dt(data.deadline);
  if (data.confDates !== undefined) props['Conf Dates'] = txt(data.confDates);
  if (data.city !== undefined) props['City'] = txt(data.city);
  if (data.state !== undefined) props['State'] = txt(data.state);
  if (data.country !== undefined) props['Country'] = txt(data.country);
  if (data.venue !== undefined) props['Venue'] = txt(data.venue);
  if (data.cfaUrl !== undefined) props['CFA URL'] = urlProp(data.cfaUrl);
  if (data.website !== undefined) props['Website'] = urlProp(data.website);
  if (data.notes !== undefined) props['Notes'] = txt(data.notes);
  if (data.status !== undefined) props['Status'] = sel(data.status);
  if (data.techPaper !== undefined) props['Tech Paper'] = chk(data.techPaper);
  if (data.paperDeadline !== undefined) props['Paper Deadline'] = dt(data.paperDeadline);
  if (data.presenter !== undefined) props['Presenter'] = txt(data.presenter);
  if (data.presDetails !== undefined) props['Presentation Details'] = txt(data.presDetails);
  if (data.cats !== undefined) props['Categories'] = msel(data.cats);
  if (data.pursueNextYear !== undefined) props['Pursue Next Year'] = sel(data.pursueNextYear);
  return props;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const { id, data } = JSON.parse(event.body);
    const properties = buildProps(data || {});

    const result = id
      ? await notionRequest('PATCH', `/v1/pages/${id}`, { properties })
      : await notionRequest('POST', '/v1/pages', { parent: { database_id: DB_CONFERENCES }, properties });

    if (result.object === 'error') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: result.message, code: result.code }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ id: result.id, success: true }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
