/**
 * This is a MOCK worker for local testing. It does not call a real certificate
 * provider or product catalogue. It validates the submitted form data, simulates
 * certificate verification/publication, publishes the BPMN messages, and
 * completes each corresponding Camunda job.
 */

const API_BASE = (process.env.CAMUNDA_API_URL || 'http://localhost:8080/v2').replace(/\/$/, '');
const WORKER_NAME = 'marketplace-local-demo-worker';
const POLL_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 1_000;
const MAX_JOBS = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function authHeaders() {
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  const username = process.env.CAMUNDA_USERNAME;
  const password = process.env.CAMUNDA_PASSWORD;
  if (username && password) {
    headers.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }
  return headers;
}

async function post(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body ?? {}),
  });

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
    const detail = typeof responseBody === 'string'
      ? responseBody
      : JSON.stringify(responseBody);
    throw new Error(`${response.status} ${response.statusText} for ${path}: ${detail}`);
  }
  return responseBody;
}

async function publishBpmnMessage(name, variables, extraVariables = {}) {
  const listingId = variables?.listingId;
  if (listingId === undefined || listingId === null || String(listingId).trim() === '') {
    throw new Error(`Cannot send '${name}': job has no listingId variable.`);
  }

  // Publish with a short TTL so messages can wait for a catch-event
  // subscription if the receiving process has not reached it yet.
  await post('/messages/publication', {
    name,
    correlationKey: String(listingId),
    timeToLive: 300000,
    variables: { ...variables, ...extraVariables },
  });
  console.log(`  Message published/buffered: ${name} (listingId=${listingId})`);
}

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
    if (v[key] === undefined || v[key] === null || String(v[key]).trim() === '') {
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
    errors.push('Availability end must be on or after availability start.');
  }

  return {
    isValid: errors.length === 0,
    validationErrors: errors.join('\n'),
  };
}

async function runMockHandler(type, job) {
  const v = job.variables || {};
  let outputVariables = {};

  switch (type) {
    // Producer -> Form verification message start event.
    case 'publish-product-listing':
      await publishBpmnMessage('Product listing submitted', v, { verificationAttempts: 0 });
      break;

    // Marketplace validation service (local simulation).
    case 'validate-product-data':
      outputVariables = validateListing(v);
      console.log(`  Listing validation: ${outputVariables.isValid ? 'valid' : 'invalid'}`);
      if (outputVariables.validationErrors) console.log(`  ${outputVariables.validationErrors.replace(/\n/g, ' | ')}`);
      break;

    // Form verification -> Producer correction request.
    case 'send-validation-errors':
      await publishBpmnMessage('Correction request', v);
      break;

    // Certificate API (local simulation only).
    // Enter a certificate ID beginning with INVALID to simulate an invalid certificate.
    case 'verify-organic-certificate': {
      const certificateId = String(v.certificateId || '').trim();
      outputVariables = {
        certificateValid: certificateId.length > 0 && !certificateId.toUpperCase().startsWith('INVALID'),
      };
      console.log(`  Mock certificate result: ${outputVariables.certificateValid ? 'valid' : 'invalid'}`);
      break;
    }

    // Form verification -> Producer certificate problem.
    case 'notify-producer-certificate-invalid':
      await publishBpmnMessage('Certificate problem', v);
      break;

    // Producer -> Form verification after the producer corrects the listing.
    case 'publish-corrected-product-listing':
      await publishBpmnMessage('Corrected product listing', v);
      break;

    // Producer -> Form verification after an administrator decision.
    case 'publish-certificate-decision':
      await publishBpmnMessage('Producer certificate decision', v);
      break;

    // Product catalogue (local simulation only).
    case 'publish-product':
      outputVariables = { cataloguePublished: true };
      console.log('  Mock catalogue publication completed.');
      break;

    // Form verification -> Producer publication notice.
    case 'notify-producer-published':
      await publishBpmnMessage('Listing published notice', v);
      break;

    // Producer draft timeout path (two-hour timer in the BPMN).
    case 'save-listing-as-draft':
      outputVariables = { savedAsDraft: true };
      console.log('  Mock draft save completed.');
      break;

    default:
      throw new Error(`No mock handler is configured for job type '${type}'.`);
  }

  const completion = Object.keys(outputVariables).length > 0
    ? { variables: outputVariables }
    : {};
  await post(`/jobs/${encodeURIComponent(job.jobKey)}/completion`, completion);
  console.log(`  Completed job ${job.jobKey} (${type})`);
}

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
          // Leave the job incomplete; Camunda can make it available again when
          // its activation timeout expires. The error is printed for diagnosis.
          console.error(`Job ${job.jobKey} (${type}) was not completed:`, error.message);
        }
      }
    } catch (error) {
      console.error(`Worker poll failed for '${type}': ${error.message}`);
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
  console.log(`Marketplace mock worker connecting to ${API_BASE}`);
  console.log('Starting workers for the job types used in your BPMN.');
  console.log('This simulates the certificate and catalogue services; it is for local testing only.');
  await Promise.all(JOB_TYPES.map((type) => pollJobType(type)));
}

main().catch((error) => {
  console.error('Worker stopped:', error);
  process.exitCode = 1;
});
