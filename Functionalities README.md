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

Purpose: keep product availability correct as stock and season change.

Triggers:

1. The producer updates quantity or the availability window (message or user start).
2. A stock-decrement message arrives from the order process (message start event).
3. A timer event fires at season start and end.

Actors: Producer, Inventory Service, Product Catalogue Service, Notification Service. The Customer Ordering process is the external message source.

**Main flow:**

1. The new stock and availability data is received.
2. A DMN decision table applies the rule: available only if stock > 0 AND today is within the seasonal window.
3. A service task updates the status to AVAILABLE or UNAVAILABLE.
4. If stock reaches zero, the product is automatically made unavailable and the producer is notified.
5. On replenishment, the rule is re-evaluated, and the product is re-enabled only if still in season.
6. An audit entry is recorded for each change, which also supports the producer’s accounting and traceability needs.

**Alternative and exception paths:**

1. Replenished but out of season: stays unavailable, and the producer is told why.
2. Season ended by timer: auto-unavailable.
3. Invalid update (negative stock, end date before start date): rejected back to the form.
4. Concurrent updates: the stock decrement is rejected if it would go below zero, and the order process is informed.
5. Optional: a low-stock alert threshold.