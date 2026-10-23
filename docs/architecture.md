# QuickNotes System Architecture

## 1. Purpose and assumptions

QuickNotes is moving from a browser-only prototype to a hosted service for **1 million registered users**. This is a planning estimate, not a benchmark. Actual traffic should be measured and the architecture adjusted from load tests and production telemetry.

Assumptions used for the baseline:
- 1,000,000 registered users.
- 10% are active on a typical day: 100,000 daily active users (DAU).
- Each DAU reads 50 note/feed pages per day.
- Each DAU creates 1 note per day.
- Each note averages 2 KB of text and metadata for storage estimation.
- 86,400 seconds per day and 365 days per year.
- Peak traffic is estimated at 5 times the average rate.
- The estimate excludes indexes, backups, replicas, logs, attachments and database overhead unless stated.

## 2. Functional requirements

1. Users can register, authenticate and sign out securely.
2. Authenticated users can create, read, update and delete their own notes.
3. Users can list and search notes with pagination.
4. Users can create tags and associate tags with notes.
5. The system validates inputs and returns consistent JSON errors.
6. Users cannot read or change another user's private notes.
7. Clients receive clear loading, success, empty and error feedback.

## 3. Non-functional requirements

- **Availability:** target 99.9% monthly service availability, subject to an agreed service-level objective.
- **Performance:** aim for a p95 API response under 300 ms for ordinary reads under expected load, excluding client network latency.
- **Scalability:** scale stateless app servers horizontally and cache safe, frequently read data.
- **Security:** TLS, strong password hashing, access control, input validation, rate limiting and secrets management.
- **Durability:** automated database backups and tested restore procedures.
- **Consistency:** committed note writes go to the primary database; replicas may lag briefly for read traffic.
- **Observability:** centralized logs, metrics, tracing, health checks and alerts.
- **Maintainability:** versioned API, automated tests, migrations and documented deployments.

## 4. Load and storage estimates

### Daily active users

`1,000,000 registered users × 10% active daily = 100,000 DAU`

### Reads per second

Daily read requests:

`100,000 DAU × 50 reads/day = 5,000,000 reads/day`

Average reads per second:

`5,000,000 ÷ 86,400 = 57.87 reads/second`

Estimated peak at 5× average:

`57.87 × 5 = 289.35 ≈ 290 reads/second`

### Writes per second

Daily note writes:

`100,000 DAU × 1 note/day = 100,000 writes/day`

Average writes per second:

`100,000 ÷ 86,400 = 1.16 writes/second`

Estimated peak at 5× average:

`1.16 × 5 = 5.8 ≈ 6 writes/second`

These are note create rates. Edits, deletes, tag changes, authentication and background work add more requests.

### Storage per year

Text-only estimate at 2 KB per note:

`100,000 notes/day × 2 KB = 200,000 KB/day ≈ 200 MB/day (decimal units)`

`200 MB/day × 365 = 73,000 MB/year ≈ 73 GB/year`

This is raw note content and assumed basic metadata only. Database indexes, replicas, backups, audit logs and operational overhead increase real storage needs. If users can attach photos or documents, store those binary objects in object storage rather than the relational database and estimate that storage separately.

### Read-heavy or write-heavy?

The workload is **read-heavy**: there are about 50 read actions for every note creation in the stated baseline. Use indexes and cache for common reads, and a read replica for scalable read queries. Writes still go to the primary database to preserve a clear source of truth.

## 5. Architecture diagram

```text
                         ┌────────────────────┐
                         │  User / Web Client │
                         └─────────┬──────────┘
                                   │ HTTPS
                                   v
                         ┌────────────────────┐
                         │        DNS         │
                         └─────────┬──────────┘
                                   v
                         ┌────────────────────┐
                         │ CDN / Edge Cache   │
                         └─────────┬──────────┘
                                   v
                         ┌────────────────────┐
                         │ Load Balancer / WAF│
                         └───────┬─────┬──────┘
                                 │     │
                     ┌───────────v┐   ┌v───────────┐
                     │ App Server 1│   │App Server 2│
                     │ (stateless) │   │ (stateless)│
                     └──────┬──────┘   └─────┬─────┘
                            │                │
                  ┌─────────┴──────┐  ┌──────┴─────────┐
                  │                │  │                │
                  v                v  v                v
            ┌───────────┐   ┌──────────────┐    ┌─────────────┐
            │   Cache   │   │ Primary DB   │───>│ Read Replica│
            │ (e.g.Redis)│  │ (writes)     │rep │ (read scale)│
            └───────────┘   └──────┬───────┘    └─────────────┘
                                   │
                                   v
                            ┌────────────┐
                            │   Queue    │
                            └─────┬──────┘
                                  v
                            ┌────────────┐
                            │   Worker   │
                            └────────────┘
```

The queue and worker support asynchronous tasks such as notifications, search indexing, export jobs and future attachment processing. The worker writes results or job status back to the appropriate data store. The database's primary-to-replica arrow represents replication, which may be asynchronous.

## 6. What each component solves

| Component | Problem it solves |
|---|---|
| User / web client | Provides the interface where users create and read notes. |
| DNS | Resolves the service hostname to the correct edge or load-balancer endpoint. |
| CDN / edge cache | Reduces latency and origin traffic for cacheable static assets such as CSS, JavaScript and images. |
| Load balancer / WAF | Distributes requests across healthy app servers and filters common malicious traffic. |
| App server 1 | Handles API validation, authorization and business logic for requests. |
| App server 2 | Adds capacity and lets the service continue if one app instance fails. |
| Cache | Serves frequently requested, safe-to-cache data quickly and reduces repeated database reads. |
| Primary database | Provides the authoritative transactional store for notes, users and tags. |
| Read replica | Handles eligible read queries and reduces read pressure on the primary database. |
| Queue | Buffers background jobs so slow work does not hold up user-facing requests. |
| Worker | Processes queued jobs with retries and idempotency to handle temporary failures safely. |

## 7. GET /notes request flow

1. The client sends `GET /v1/notes?limit=20` over HTTPS.
2. DNS resolves the service name; the CDN serves cacheable static assets if requested, while the API request proceeds to the origin.
3. The load balancer/WAF filters the request and routes it to a healthy app server.
4. The app server authenticates the user and validates pagination and filters.
5. The service checks the cache for a safe, user-scoped cached result.
6. On a cache miss, it queries the read replica when the operation can tolerate replica lag; otherwise it uses the primary.
7. The service returns a paginated JSON response and may populate the cache with a suitable short TTL.
8. The client renders notes and shows a success, empty or error state.

## 8. POST /notes request flow

1. The client sends `POST /v1/notes` with a JSON title/body and an access token.
2. The load balancer routes the request to a healthy app server.
3. The app server authenticates the user, checks note ownership context, validates the title and body, and applies rate limits.
4. The app server writes the note to the primary database in a transaction.
5. After the transaction commits, the API returns `201 Created`, the new note representation and a `Location` header.
6. If the write requires asynchronous work (for example, a notification or search-index update), the service publishes a job to the queue, preferably using a transactional outbox to avoid losing events between database commit and queue publication.
7. The worker processes the job with retries and idempotency; failures are monitored and eventually sent to a dead-letter queue after a defined retry policy.
8. Cached note lists are invalidated or updated so clients do not continue seeing stale data.

## 9. Trade-offs

### Cache speed versus freshness

Caching reduces latency and database load, but cached lists can be stale after edits or deletes. Use short TTLs, user-scoped cache keys and invalidation after writes; bypass cache for operations that require read-after-write consistency.

### Read replicas versus consistency

Replicas increase read capacity, but asynchronous replication can lag. Route strongly consistent reads (such as immediately verifying a new write) to the primary, and allow replica reads for less time-sensitive lists.

### Asynchronous queue versus simplicity

A queue keeps slow work away from the request path and smooths bursts, but introduces eventual consistency, retries and more operational complexity. Make jobs idempotent, monitor queue age, and use a dead-letter queue for repeated failures.

### Horizontal scaling versus state management

Multiple app servers improve capacity and resilience, but local in-memory state is not shared across servers. Keep application servers stateless, store shared state in managed data services, and use external session storage or signed tokens.

## 10. Avoiding single points of failure

- Run at least two app servers across separate availability zones and configure health-checked load balancing.
- Deploy redundant DNS and edge/CDN infrastructure through a managed provider.
- Use a highly available cache deployment or cluster; treat cache loss as a performance degradation rather than data loss.
- Configure database backups, point-in-time recovery, monitoring and a tested primary failover procedure; use multi-zone database deployment where available.
- Run queue brokers in a replicated or managed highly available configuration, and ensure jobs can be retried safely.
- Monitor all critical components, define alerts and practice recovery through documented disaster-recovery exercises.

A diagram with two app servers does not alone make every dependency highly available; DNS, cache, database, queue and worker deployments must also be configured for redundancy. The team should document recovery-time and recovery-point objectives and test them.
