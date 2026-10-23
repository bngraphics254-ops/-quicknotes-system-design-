# QuickNotes REST API Design

## 1. Purpose and conventions

This document describes the **real QuickNotes backend API**, not the JSONPlaceholder practice API used by the browser client. The API uses HTTPS, JSON request and response bodies, and REST-style resource paths. Authenticated endpoints use `Authorization: Bearer <access-token>`. Dates are ISO 8601 UTC strings. IDs are opaque strings or UUIDs.

Base URL: `https://api.quicknotes.example/v1`

## 2. Endpoint catalogue

| Method | Path | Description | Success status |
|---|---|---|---:|
| `GET` | `/notes` | List the authenticated user's notes; supports `limit`, `cursor`, `q` and `tag` filters. | `200 OK` |
| `POST` | `/notes` | Create a note owned by the authenticated user. | `201 Created` |
| `GET` | `/notes/{noteId}` | Fetch one note owned by the authenticated user. | `200 OK` |
| `PATCH` | `/notes/{noteId}` | Update supplied fields of an existing note. | `200 OK` |
| `DELETE` | `/notes/{noteId}` | Delete a note owned by the authenticated user. | `204 No Content` |
| `GET` | `/tags` | List tags available to the authenticated user. | `200 OK` |
| `POST` | `/notes/{noteId}/tags` | Associate an existing tag with a note. | `201 Created` |
| `DELETE` | `/notes/{noteId}/tags/{tagId}` | Remove a tag association from a note. | `204 No Content` |
| `GET` | `/users/me` | Return the authenticated user's profile. | `200 OK` |

The server must only return or modify resources the authenticated user is authorized to access. Pagination should use a bounded `limit` (for example, 1–100) and a cursor for large result sets.

## 3. Create a note

### Request

`POST /v1/notes`

Headers: `Content-Type: application/json`, `Authorization: Bearer <access-token>`

```json
{
  "title": "Prepare for class",
  "body": "Review the API design notes before the lesson.",
  "tagIds": ["tag-study"]
}
```

The title is required and must contain 1–100 characters after trimming. The body is optional and has a documented maximum length enforced by the server.

### Success response

Status: `201 Created`

```json
{
  "data": {
    "id": "note_01J9QX6M",
    "userId": "user_123",
    "title": "Prepare for class",
    "body": "Review the API design notes before the lesson.",
    "createdAt": "2026-10-23T08:30:00Z",
    "updatedAt": "2026-10-23T08:30:00Z",
    "tags": [
      { "id": "tag-study", "name": "Study" }
    ]
  }
}
```

The response includes a `Location: /v1/notes/note_01J9QX6M` header.

## 4. List notes

### Request

`GET /v1/notes?limit=2&cursor=eyJpZCI6IjEwMCJ9`

### Success response

Status: `200 OK`

```json
{
  "data": [
    {
      "id": "note_01J9QX6M",
      "userId": "user_123",
      "title": "Prepare for class",
      "body": "Review the API design notes before the lesson.",
      "createdAt": "2026-10-23T08:30:00Z",
      "updatedAt": "2026-10-23T08:30:00Z",
      "tags": []
    },
    {
      "id": "note_01J9QX6N",
      "userId": "user_123",
      "title": "Shopping list",
      "body": "Bread, milk and fruit.",
      "createdAt": "2026-10-22T17:10:00Z",
      "updatedAt": "2026-10-22T17:10:00Z",
      "tags": []
    }
  ],
  "page": {
    "limit": 2,
    "nextCursor": "eyJpZCI6Ijk4In0",
    "hasMore": true
  }
}
```

An empty collection is a successful response with `"data": []` and `"hasMore": false`.

## 5. Update and delete

### Update

`PATCH /v1/notes/{noteId}`

```json
{
  "title": "Revised class preparation",
  "body": "Review API design and database relationships."
}
```

A successful update returns `200 OK` and the updated note in a `data` object. Only supplied, permitted fields are changed.

### Delete

`DELETE /v1/notes/{noteId}`

A successful delete returns `204 No Content` with no response body. Deleting a note also removes its rows from `note_tags` in the same transaction or through configured cascading foreign keys.

## 6. Error statuses

| Status | Meaning | Typical cause |
|---:|---|---|
| `400 Bad Request` | Invalid request | Missing title, malformed JSON or invalid pagination value |
| `401 Unauthorized` | Authentication is missing or invalid | Expired or missing access token |
| `403 Forbidden` | Authenticated but not allowed | Attempt to access an operation forbidden by policy |
| `404 Not Found` | Resource not found | Note or tag does not exist, or is not visible to the caller |
| `409 Conflict` | State conflict | Conflicting unique tag name or stale update |
| `422 Unprocessable Entity` | Valid JSON but invalid fields | Title or body violates validation rules |
| `429 Too Many Requests` | Rate limit exceeded | Too many requests from a user or client |
| `500 Internal Server Error` | Unexpected server error | Unhandled application or database failure |
| `503 Service Unavailable` | Temporarily unavailable | Service is overloaded or under maintenance |

### Example error body

Status: `400 Bad Request`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      {
        "field": "title",
        "issue": "Title is required and must be no longer than 100 characters."
      }
    ],
    "requestId": "req_01J9QZ1A"
  }
}
```

Error responses should avoid exposing stack traces, SQL statements, secrets or internal infrastructure details. `requestId` allows support staff to trace a failed request in server logs.

## 7. Security and operational notes

- Require TLS and validated authentication on private endpoints.
- Check ownership on every note operation to prevent insecure direct-object references.
- Validate and limit request sizes on the server; browser validation alone is not security.
- Apply per-user rate limits and return `429` with a suitable `Retry-After` header.
- Log request IDs, latency and failures without logging note contents or access tokens.
- Use consistent error shapes and API versioning to make client behavior predictable.
