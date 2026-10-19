## Functionality 1: Product Listing, Validation and Publication

Purpose: a registered producer submits a new product, it is validated (including organic certification), and it is published to customers.

Trigger: the producer starts “List new product”.

Actors: Producer, Marketplace Administrator, Organic Certification Verification Service, Product Catalogue Service.

**Main flow:**

1. The producer completes a Camunda Form: name, description, category, price, quantity, availability period, farm origin, harvest date, allergens, organic claim and certificate ID, best-before date.
2. A service task or DMN validates the data (mandatory fields, price > 0, dates sensible, allergens declared).
3. If invalid, the producer is returned to the form to correct it.
4. If an organic claim is made, a service task calls the simulated verification API.
5. If valid, the product is published to the catalogue and the producer is notified.

**Alternative and exception paths:**

1. Verification service unavailable: a boundary error or timer event triggers a bounded retry loop. After the retries fail, an admin user task lets the product be published as “organic pending”, or the producer may publish without the organic claim.
2. Verification fails (invalid certificate): the producer is told and may correct the certificate or withdraw the claim. The organic badge is never shown unverified.
3. Abandoned submission: a timer boundary event saves the listing as a draft.


## Functionality 2: Inventory and Seasonal Availability Management