# Security Specification — SIMKIR (Kartu Inventaris Ruangan)

## 1. Data Invariants
1. **Identity & Ownership**: Every document in `/ruangan/{ruanganId}`, `/barang/{barangId}`, and `/mutasi/{mutasiId}` must belong to an authenticated, email-verified user (`request.auth.uid == incoming().ownerId` and `request.auth.token.email_verified == true`).
2. **Path Variable Hardening**: Every document ID (`ruanganId`, `barangId`, `mutasiId`) for single-document operations (`get`, `create`, `update`, `delete`) must satisfy `isValidId(id)` (`id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
3. **Strict Schema & No Shadow Fields**: Every `create` and `update` must pass `isValidRuangan`, `isValidBarang`, or `isValidMutasi` enforcing exact `keys().hasAll(...)` and `keys().hasOnly(...)` along with strict string `.size()` bounds and enum constraints.
4. **Immutable Fields**: `ownerId` and `createdAt` cannot be modified during `update`.
5. **Temporal Integrity**: `createdAt == request.time` on `create` and `updatedAt == request.time` on `update`.
6. **Relational Integrity**: Creating a `Barang` requires `exists(/databases/$(database)/documents/ruangan/$(incoming().ruanganId))` and ownership of that `Ruangan`. Creating a `Mutasi` requires `exists(/databases/$(database)/documents/barang/$(incoming().barangId))` and `exists(/databases/$(database)/documents/ruangan/$(incoming().ruanganTujuanId))`.
7. **Secure List Queries**: `allow list` on all collections enforces `isSignedIn() && isEmailVerified() && resource.data.ownerId == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads
1. **Unverified Email Write**: Attempt `create` on `/ruangan/r-01` with `email_verified == false`.
2. **Owner Spoofing on Create**: Attempt `create` on `/ruangan/r-01` where `ownerId != request.auth.uid`.
3. **Shadow Field Injection on Create**: Attempt `create` on `/barang/b-01` with an extra field `"isAdmin": true`.
4. **ID Poisoning**: Attempt `create` on `/ruangan/invalid$id!@#` violating `^[a-zA-Z0-9_\-]+$`.
5. **Oversized String DoS**: Attempt `create` on `/ruangan/r-01` with `namaRuangan` > 120 chars.
6. **Invalid Enum Value**: Attempt `create` on `/barang/b-01` with `kondisi: "Hancur Lebur"`.
7. **Orphaned Barang Create**: Attempt `create` on `/barang/b-01` referencing a non-existent `ruanganId`.
8. **Client Timestamp Forgery**: Attempt `create` on `/ruangan/r-01` where `createdAt != request.time`.
9. **Immutable Owner Mutation**: Attempt `update` on `/barang/b-01` changing `ownerId`.
10. **Immutable CreatedAt Mutation**: Attempt `update` on `/ruangan/r-01` changing `createdAt`.
11. **Value Poisoning on Update**: Attempt `update` on `/barang/b-01` setting `hargaPerolehan` to a string or negative number.
12. **Blanket List Query Scraping**: Attempt `list` on `/barang` without `where('ownerId', '==', request.auth.uid)`.
