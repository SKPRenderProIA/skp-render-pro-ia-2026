# Security Specification — SKP Render Pro IA

## 1. Data Invariants
- Each license document must have a valid string `id`, `clientName`, `pcId`, `validUntil`, and `status` in ['active', 'revoked'].
- License documents can only be created, updated, and deleted by authorized administrative contexts or authenticated owners.
- The `pcId` represents hardware UUID and must not exceed 256 characters.

## 2. Protected Collections
- `/licenses/{licenseId}`: Stores activated user licenses and PC IDs. Read/write operations require valid credentials. Default deny for unknown collections.
