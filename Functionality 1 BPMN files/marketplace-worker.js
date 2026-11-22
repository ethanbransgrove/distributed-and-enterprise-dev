/**
 * Camunda SaaS worker for the Marketplace BPMN.
 * Authenticates via OAuth 2.0 client credentials and polls the SaaS REST API.
 */

// ── Configuration ──────────────────────────────────────────────────────────
const CAMUNDA_CLIENT_ID = process.env.CAMUNDA_CLIENT_ID;
const CAMUNDA_CLIENT_SECRET = process.env.CAMUNDA_CLIENT_SECRET;
const CAMUNDA_OAUTH_URL =
  process.env.CAMUNDA_OAUTH_URL ||
  'https://login.cloud.camunda.io/oauth/token';
const CAMUNDA_REST_ADDRESS = (
  process.env.CAMUNDA_REST_ADDRESS ||
  'http://localhost:8080'
).replace(/\/$/, '');

if (!CAMUNDA_CLIENT_ID || !CAMUNDA_CLIENT_SECRET) {
  console.error(
    'FATAL: Set CAMUNDA_CLIENT_ID and CAMUNDA_CLIENT_SECRET environment variables.'
  );
  process.exit(1);
}

const API_BASE = `${CAMUNDA_REST_ADDRESS}/v2`;
const WORKER_NAME = 'marketplace-saas-worker';
const POLL_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 1_000;
const MAX_JOBS = 5;

// ── OAuth token management ─────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  // Refresh if token is missing or will expire within 30 seconds
  if (cachedToken && Date.now() < tokenExpiresAt - 30_000) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CAMUNDA_CLIENT_ID,
    client_secret: CAMUNDA_CLIENT_SECRET,
    audience: 'zeebe.camunda.io',
  });

  const response = await fetch(CAMUNDA_OAUTH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `OAuth token request failed (${response.status}): ${text}`
    );
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // expires_in is in seconds
  tokenExpiresAt = Date.now() + (data.expires_in || 300) * 1000;
  console.log('  [auth] Obtained new OAuth access token.');
  return cachedToken;
}

async function authHeaders() {
  const token = await getAccessToken();
  return {
    'content-type': 'application/json',
    accept: 'application/json',
    authorization: `Bearer ${token}`,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── HTTP helpers (now OAuth-aware) ─────────────────────────────────────────
async function post(path, body, retryOn401 = true) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body ?? {}),
  });

  // If token was rejected, force a refresh and retry once
  if (response.status === 401 && retryOn401) {
    cachedToken = null;
    tokenExpiresAt = 0;
    return post(path, body, false);
  }

  const responseText = await response.text();
  let responseBody = null;
  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
  }

  if (!response.ok) {
    const detail =
      typeof responseBody === 'string'
        ? responseBody
        : JSON.stringify(responseBody);
    throw new Error(
      `${response.status} ${response.statusText} for ${path}: ${detail}`
    );
  }
  return responseBody;
}

// ── Message publishing (unchanged logic) ───────────────────────────────────
async function publishBpmnMessage(name, variables, extraVariables = {}) {
  const listingId = variables?.listingId;
  if (
    listingId === undefined ||
    listingId === null ||
    String(listingId).trim() === ''
  ) {
    throw new Error(
      `Cannot send '${name}': job has no listingId variable.`
    );
  }

  await post('/messages/publication', {
    name,
    correlationKey: String(listingId),
    timeToLive: 300000,
    variables: { ...variables, ...extraVariables },
  });
  console.log(
    `  Message published/buffered: ${name} (listingId=${listingId})`
  );
}

// ── Validation (unchanged) ─────────────────────────────────────────────────
function validateListing(v) {
  const errors = [];
  const required = [
    ['productName', 'Product name'],
    ['description', 'Description'],
    ['category', 'Category'],
    ['availabilityStart', 'Availability start'],
    ['availabilityEnd', 'Availability end'],
    ['farmOrigin', 'Farm origin'],
    ['farmPostcode', 'Farm postcode'],
    ['bestBeforeDate', 'Best-before date'],
  ];

  for (const [key, label] of required) {
    if (
      v[key] === undefined ||
      v[key] === null ||
      String(v[key]).trim() === ''
    ) {
      errors.push(`${label} is required.`);
    }
  }

  const price = Number(v.price);
  if (!Number.isFinite(price) || price <= 0) {
    errors.push('Price must be greater than £0.');
  }

  const quantity = Number(v.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    errors.push('Available quantity must be greater than 0.');
  }

  const start = Date.parse(v.availabilityStart);
  const end = Date.parse(v.availabilityEnd);
  if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
    errors.push(
      'Availability end must be on or after availability start.'
    );
  }

  const bestBefore = Date.parse(v.bestBeforeDate);
  if (
    Number.isFinite(start) &&
    Number.isFinite(bestBefore) &&
    bestBefore <= start
  ) {
    errors.push(
      'Best-before date has to be after availability start date.'
    );
  }

  return {
    isValid: errors.length === 0,
    validationErrors: errors.join('\n'),
  };
}

// ── Job handlers (unchanged logic) ─────────────────────────────────────────
async function runMockHandler(type, job) {
  const v = job.variables || {};
  let outputVariables = {};

  switch (type) {
    case 'publish-product-listing':
      await publishBpmnMessage('Product listing submitted', v, {
        verificationAttempts: 0,
      });
      break;

    case 'validate-product-data':
      outputVariables = validateListing(v);
      console.log(
        `  Listing validation: ${
          outputVariables.isValid ? 'valid' : 'invalid'
        }`
      );
      if (outputVariables.validationErrors)
        console.log(
          `  ${outputVariables.validationErrors.replace(/\n/g, ' | ')}`
        );
      break;

    case 'send-validation-errors':
      await publishBpmnMessage('Correction request', v);
      break;

    case 'verify-organic-certificate': {
      const certificateId = String(v.certificateId || '').trim();
      outputVariables = {
        certificateValid:
          certificateId.length > 0 &&
          !certificateId.toUpperCase().startsWith('INVALID'),
      };
      console.log(
        `  Mock certificate result: ${
          outputVariables.certificateValid ? 'valid' : 'invalid'
        }`
      );
      break;
    }

    case 'notify-producer-certificate-invalid':
      await publishBpmnMessage('Certificate problem', v);
      break;

    case 'publish-corrected-product-listing':
      await publishBpmnMessage('Corrected product listing', v);
      break;

    case 'publish-certificate-decision':
      await publishBpmnMessage('Producer certificate decision', v);
      break;

    case 'publish-product':
      outputVariables = { cataloguePublished: true };
      console.log('  Mock catalogue publication completed.');
      break;

    case 'notify-producer-published':
      await publishBpmnMessage('Listing published notice', v);
      break;

    case 'save-listing-as-draft':
      outputVariables = { savedAsDraft: true };
      console.log('  Mock draft save completed.');
      break;

    default:
      throw new Error(
        `No mock handler is configured for job type '${type}'.`
      );
  }

  const completion =
    Object.keys(outputVariables).length > 0
      ? { variables: outputVariables }
      : {};
  await post(
    `/jobs/${encodeURIComponent(job.jobKey)}/completion`,
    completion
  );
  console.log(`  Completed job ${job.jobKey} (${type})`);
}

// ── Polling (now OAuth-aware) ──────────────────────────────────────────────
async function pollJobType(type) {
  while (true) {
    try {
      const result = await post('/jobs/activation', {
        type,
        worker: WORKER_NAME,
        timeout: POLL_TIMEOUT_MS,
        maxJobsToActivate: MAX_JOBS,
        requestTimeout: REQUEST_TIMEOUT_MS,
      });

      for (const job of result?.jobs || []) {
        console.log(`Received job: ${type} (${job.jobKey})`);
        try {
          await runMockHandler(type, job);
        } catch (error) {
          console.error(
            `Job ${job.jobKey} (${type}) was not completed:`,
            error.message
          );
        }
      }
    } catch (error) {
      console.error(
        `Worker poll failed for '${type}': ${error.message}`
      );
      await sleep(1500);
    }
  }
}

const JOB_TYPES = [
  'publish-product-listing',
  'validate-product-data',
  'send-validation-errors',
  'verify-organic-certificate',
  'notify-producer-certificate-invalid',
  'publish-product',
  'notify-producer-published',
  'save-listing-as-draft',
  'publish-corrected-product-listing',
  'publish-certificate-decision',
];

async function main() {
  console.log(`Marketplace SaaS worker connecting to ${API_BASE}`);
  console.log('Starting workers for the job types used in your BPMN.');
  console.log('This simulates the certificate and catalogue services; it is for local testing only.');

  // Pre-fetch the token once so all polling loops share the same cached token
  console.log('  [auth] Pre-fetching initial OAuth access token...');
  await getAccessToken();

  await Promise.all(JOB_TYPES.map((type) => pollJobType(type)));
}

main().catch((error) => {
  console.error('Worker stopped:', error);
  process.exitCode = 1;
});