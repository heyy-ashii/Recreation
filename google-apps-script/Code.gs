/**
 * OGEA - Programs store on Google Sheets.
 *
 * Deploy as a Web App and point the API's SHEETS_API_URL at the deployment URL.
 * The API talks to this script over JSON, so the Express routes and the
 * frontend keep the exact same contract they had with MongoDB.
 *
 * SETUP (one time)
 *   1. Project Settings > Script properties, add:
 *        SHEETS_TOKEN  = a long random string (also set as SHEETS_API_TOKEN in the API .env)
 *   2. Run setup() once to create the "Programs" tab with the right headers.
 *   3. Deploy > New deployment > Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *      (the token, not the URL, is what actually protects the data)
 *
 * The token is compared in constant time and never logged.
 */

var PROGRAMS_SHEET = 'Programs';

// Programs tab columns. The API maps these to the shape the frontend expects.
var PROGRAM_COLUMNS = [
  'id',
  'title',
  'organizer',
  'type',
  'category',
  'venue',
  'about',
  'registrationLink',
  'contact',
  'imageurls',
  'tags',
  'status',
  'deadline',
  'eventDate',
  'createdBy',
  'createdAt',
  'updatedAt',
];

var EDITABLE_COLUMNS = ['title', 'organizer', 'type', 'category', 'venue', 'about', 'registrationLink', 'contact', 'imageurls', 'tags', 'status', 'deadline', 'eventDate'];
var PROGRAM_STATUSES = ['Live', 'Recent', 'Closed'];

/* ------------------------------------------------------------------ */
/* One-time setup                                                      */
/* ------------------------------------------------------------------ */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PROGRAMS_SHEET) || ss.insertSheet(PROGRAMS_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, PROGRAM_COLUMNS.length).setValues([PROGRAM_COLUMNS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, PROGRAM_COLUMNS.length).setFontWeight('bold');
  }
  return 'Programs tab ready';
}

/* ------------------------------------------------------------------ */
/* HTTP entry points                                                   */
/* ------------------------------------------------------------------ */

function doGet(e) {
  return handle_(e, 'GET');
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ error: 'Invalid JSON body' });
  }
  return handle_(e, body.action || 'GET', body);
}

function handle_(e, action, body) {
  var params = (e && e.parameter) || {};

  if (action === 'GET' && params.action === 'health') {
    return json_({ ok: true, sheet: PROGRAMS_SHEET });
  }
  if (!isAuthorized_(params.token)) {
    return json_({ error: 'Unauthorized' });
  }

  try {
    switch (action) {
      case 'GET':
        return json_(listPrograms_(params));
      case 'get':
        return json_(getProgram_(params.id));
      case 'create':
        return json_(createProgram_(body.data));
      case 'update':
        return json_(updateProgram_(params.id || body.id, body.data));
      case 'delete':
        return json_({ deleted: deleteProgram_(params.id || body.id) });
      case 'count':
        return json_({ total: readRows_().length });
      case 'countLive':
        return json_({ total: readRows_().filter(function (r) { return r.status === 'Live'; }).length });
      case 'categories':
        return json_(categoryCounts_());
      default:
        return json_({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return json_({ error: String(err && err.message ? err.message : err) });
  }
}

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

function listPrograms_(params) {
  var rows = readRows_();

  if (params.category && params.category !== 'All') {
    rows = rows.filter(function (r) { return r.category === params.category; });
  }
  if (params.status) {
    rows = rows.filter(function (r) { return r.status === params.status; });
  }
  if (params.q) {
    var needle = String(params.q).toLowerCase();
    rows = rows.filter(function (r) {
      var hit = ['title', 'organizer', 'category', 'type', 'venue', 'about'].some(function (key) {
        return String(r[key] || '').toLowerCase().indexOf(needle) !== -1;
      });
      return hit || (r.tags || []).some(function (t) { return String(t).toLowerCase().indexOf(needle) !== -1; });
    });
  }

  var sort = params.sort || 'newest';
  rows.sort(function (a, b) {
    if (sort === 'deadline') {
      var da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      var db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (da !== db) return da - db;
    }
    var ca = new Date(a.createdAt || 0).getTime();
    var cb = new Date(b.createdAt || 0).getTime();
    return sort === 'oldest' ? ca - cb : cb - ca;
  });

  var total = rows.length;
  var limit = Math.max(1, Math.min(100, Number(params.limit) || 50));
  var page = Math.max(1, Number(params.page) || 1);
  var slice = rows.slice((page - 1) * limit, (page - 1) * limit + limit);

  if (params.view === 'summary') {
    slice = slice.map(summary_);
  }
  return { results: slice.length, total: total, page: page, pages: Math.ceil(total / limit), programs: slice };
}

function getProgram_(id) {
  var found = readRows_().filter(function (r) { return r.id === id; })[0];
  if (!found) throw new Error('Program not found');
  return { program: found };
}

function createProgram_(data) {
  validate_(data, false);
  var now = new Date().toISOString();
  var row = normalize_(data);
  row.id = (data && data.id) || Utilities.getUuid();
  row.createdAt = now;
  row.updatedAt = now;

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    sheet_().appendRow(PROGRAM_COLUMNS.map(function (col) { return serialize_(col, row[col]); }));
  } finally {
    lock.releaseLock();
  }
  return { program: row };
}

function updateProgram_(id, data) {
  if (!id) throw new Error('id is required');
  validate_(data, true);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = sheet_();
    var rows = sheet.getDataRange().getValues();
    var header = rows[0];
    var idCol = header.indexOf('id');
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][idCol] === id) {
        var current = rowToObject_(header, rows[i]);
        var patch = normalize_(data);
        for (var key in patch) {
          if (patch[key] !== undefined) current[key] = patch[key];
        }
        current.updatedAt = new Date().toISOString();
        sheet.getRange(i + 1, 1, 1, header.length).setValues([header.map(function (col) { return serialize_(col, current[col]); })]);
        return { program: current };
      }
    }
    throw new Error('Program not found');
  } finally {
    lock.releaseLock();
  }
}

function deleteProgram_(id) {
  if (!id) throw new Error('id is required');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = sheet_();
    var rows = sheet.getDataRange().getValues();
    var idCol = rows[0].indexOf('id');
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][idCol] === id) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

function categoryCounts_() {
  var counts = {};
  readRows_().forEach(function (r) {
    if (!r.category) return;
    counts[r.category] = (counts[r.category] || 0) + 1;
  });
  return {
    categories: Object.keys(counts).map(function (name) {
      return { name: name, count: counts[name] };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Sheet <-> object helpers                                            */
/* ------------------------------------------------------------------ */

function sheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PROGRAMS_SHEET);
  if (!sheet) throw new Error('Missing "' + PROGRAMS_SHEET + '" tab. Run setup() once.');
  return sheet;
}

function readRows_() {
  var values = sheet_().getDataRange().getValues();
  if (values.length < 2) return [];
  var header = values[0];
  var idCol = header.indexOf('id');
  return values.slice(1)
    .filter(function (row) { return row[idCol]; })
    .map(function (row) { return rowToObject_(header, row); });
}

function rowToObject_(header, row) {
  var obj = {};
  header.forEach(function (col, i) { obj[col] = deserialize_(col, row[i]); });
  return obj;
}

function normalize_(data) {
  data = data || {};
  var out = {};
  EDITABLE_COLUMNS.forEach(function (col) {
    if (data[col] === undefined) return;
    if (col === 'imageurls' || col === 'tags') {
      out[col] = (Array.isArray(data[col]) ? data[col] : []).filter(Boolean).map(String);
    } else if (col === 'deadline' || col === 'eventDate') {
      out[col] = data[col] ? new Date(data[col]).toISOString() : '';
    } else {
      out[col] = String(data[col]);
    }
  });
  return out;
}

function validate_(data, partial) {
  data = data || {};
  if (!partial) {
    if (!data.title || !String(data.title).trim()) throw new Error('title is required');
    if (!data.category || !String(data.category).trim()) throw new Error('category is required');
  }
  if (data.status && PROGRAM_STATUSES.indexOf(data.status) === -1) {
    throw new Error('status must be one of ' + PROGRAM_STATUSES.join(', '));
  }
}

function serialize_(col, value) {
  if (value === undefined || value === null) return '';
  if (col === 'imageurls' || col === 'tags') return JSON.stringify(value || []);
  if (value instanceof Date) return value.toISOString();
  return value;
}

function deserialize_(col, value) {
  if (col === 'imageurls' || col === 'tags') {
    if (!value) return [];
    try {
      var parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return String(value).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }
  }
  if (value instanceof Date) return value.toISOString();
  if (value === '' || value === null) return col === 'status' ? 'Live' : '';
  return value;
}

function summary_(program) {
  return {
    _id: program.id,
    title: program.title,
    organizer: program.organizer,
    type: program.type,
    category: program.category,
    venue: program.venue,
    imageurls: program.imageurls || [],
    tags: program.tags || [],
    status: program.status || 'Live',
    deadline: program.deadline || undefined,
    eventDate: program.eventDate || undefined,
    createdAt: program.createdAt,
  };
}

/* ------------------------------------------------------------------ */
/* Security / response helpers                                         */
/* ------------------------------------------------------------------ */

function isAuthorized_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('SHEETS_TOKEN');
  if (!expected || !token) return false;
  if (token.length !== expected.length) return false;
  var mismatch = 0;
  for (var i = 0; i < expected.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
