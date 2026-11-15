REQUIREMENTS
- Camunda 8 Run 8.10 must be running.
- Node.js 18 or newer must be installed.
- Deploy `Functionality 1 BPMN.bpmn` and all .form files to the same Camunda 8.10 environment before running the process.

RUN IN POWERSHELL
1. Open a new PowerShell window and change to the folder containing marketplace-worker.js.
2. Check Node.js:
      node --version
3. Start the worker:
      node .\marketplace-worker.js
4. Leave this PowerShell window running while you test in Tasklist.
5. In Tasklist, start the Producer process (process ID: Process_0kdwa39).
6. Open the generated task named 'Complete product listing form' and submit the product details.

DEFAULT CONNECTION
The script connects to http://localhost:8080/v2, which is the default local
Camunda 8 Run Orchestration Cluster REST API address. To change it, set:
      $env:CAMUNDA_API_URL = 'http://localhost:8081/v2'
      node .\marketplace-worker.js

If you explicitly enabled Basic authentication, set credentials first:
      $env:CAMUNDA_USERNAME = 'demo'
      $env:CAMUNDA_PASSWORD = 'demo'

MOCK CERTIFICATE TEST
- A non-empty certificate ID is treated as valid.
- An ID starting with INVALID (for example INVALID-123) is treated as invalid.

WHAT TO EXPECT
The worker should show messages such as:
  Received job: publish-product-listing (...)
  Message published/buffered: Product listing submitted (...)
  Completed job ... (publish-product-listing)