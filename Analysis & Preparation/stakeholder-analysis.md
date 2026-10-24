# Stakeholder Analysis for Producer Product Listing and Inventory Management Use Case

This analysis table identifies the key stakeholders relevant to the Bristol Regional Food Network case study with a focus on use case 1 *Producer Product Listing and Inventory Management*. It goes into detail with their goals, interests, influence and relationship with the process of submitting, validating, publishing and maintaining product listings. 

The analysis shows the needs stated in the case study and the requirements specified in the use case as well as the inferred details from them. Its purpose is to inform our group's business process analysis, functional scope and strategic BPMN model.

---

## Stakeholder Analysis Table

| Stakeholder | Goals, needs and concerns | Influence and interest | Implications for the system |
| --- | --- | --- | --- |
| **Local food producers** | Serve local customers, be able to make product listings, maintain seasonal availability, update stock without additional training, and handle payments with sufficient audit trails for tax purposes. They need product information to be easy to change and update. | High influence with high interest. Producer start the use case and provide the information which product listings need | The process should support product submission, clear validation feedback, correcting invalid information, quantity updates and seasonal availability management.
| **Household customers, including young professionals and families** | Access to local food in an easy to use fashion and make well informed decisions using clear product details, local origin and current seasonal availability | Indirect influence with high interest. They do not manage any listings but do depend on the information from producers to be accurate. | Products should display meaningful and accurate information. Stock status must be up to date so that customers are aware of unavailability of certain products. 
| **Community groups and organisations** | Are able to find reliable local suppliers for their catering and other food related requirments. Availability of products and information of products help them to assess whether products meet their needs. | Indirect influence with high interest. Their needs help to inform the marketplace's usefulness. | Product details and availability should be clear to them in order to support purchasing decisions. Any specialised ordering requirements need confirmation before being included in the scope of project. 
| **Indpendent resturants and cafes** | Source local ingredients as well as reducing overhead effort that comes along with needing multiple small suppliers. They need dependable product and stock information. | Indirect influence and high interest. They are potential business/repeat customers whose purchasing decisions depend on listings and can lead to working business relationships. | Consistent product information and current stock can support supplier selection. Multi-vendor checkout and order coordination are wider marketplace concerns and should not really be applicable to our use case. 
| **Bristol Regional Food Network (marketplace owner)** | Connect producers with customers, support for traceability and sustainability, reducing food waste, and operate an online marketplace with reliable product information. The wider platform also requires audit trails and financial processes. | High influence with high interest. The organisation defines what the marketplace's purpose is and has an interest in the integrity of published listings. | Product records should support accurate publication, stock status and relevant traceability information. Responsibilities for reviewing listings, resolving disputes or overriding decisions must be confirmed. 
| **Organic certification verification service (external system)** | Receive the information needed to check an organic certification claim and return a verification result, where the service is needed. | Conditional influence with high relevance when an organic claim is made. Its response affects whether the listing can continue through the publication process. | The process must include a verification interaction when applicable and account for unsuccessful verification or service unavailability. The use case permits an external or smulated verification service. 
| **Marketplace platform and inventory records (system component, not human)** | Maintain consistent product information and represent publication and availability status correctly. | Operationally critical. It determines how submitted information and stock changes affect what customers can see online. | Validation, publication, quantity changes and stock status need logical rules. This component should be represented in process and system models, not as a stakeholder organisation. |    

---

## System Components and External Dependencies

**Marketplace plateform:** The platform stores product information and should manage listing publication, stock quantities as well as seasonal availability. It should validate the submitted information providing feedback when required details are missing or invalid. Must also ensure products with zero stock are unavailable to order for that period. Replenished products can become available again if they remian within their seasonal availability period.

**Organic certification verification service:** This external service checks organic certification claims when a producer indentifies a product as organic. The resulting verification outcome affects the listing process. The system should also account in the event of a failed verification and service unavailability. The use case permits either an external or simulated verification service.

These components support the use case by ensuring that product listings and availability is repsented correctly and organic claims are handle appropriately.


## Stakeholder Relationships and Competing Needs
- **Usability vs accuracy:** Producers need simple listing processes, while customers and the marketplace need accurate product information. Clear validation helps balance these needs
- **Stock management vs customer expectations:** Producers need to update stock and seasonal availability, while customers need reliable availability information.
- **Efficient publication vs verification:** Producers want timely publication, while the marketplace needs organic claims verified and verification failures or service outages handled correctly.

---

**Sources:** Case Study - v2.pdf, pages 1–2; Task 1 - Use Cases.pdf, page 1.