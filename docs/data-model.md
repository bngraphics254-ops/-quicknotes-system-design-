# QuickNotes Data Model

## 1. Database choice

QuickNotes should use a **relational SQL database such as PostgreSQL** for its core data. Users own notes, tags are reusable, and the note-to-tag association needs referential integrity. Transactions and foreign keys protect relationships; indexes and read replicas support growth. Photos or other large binary objects would belong in object storage rather than being stored directly in these relational tables.

## 2. Entities and relationships

- **users**: one user can own many notes and create many tags.
- **notes**: each note belongs to one user; a user's notes are isolated by `user_id`.
- **tags**: each tag belongs to the user who created it and can be applied to multiple notes.
- **note_tags**: join table linking notes and tags. It implements a many-to-many relationship and prevents the same tag from being attached to the same note twice.

Relationship summary:
- `users 1 ─── many notes`
- `users 1 ─── many tags`
- `notes many ─── many tags`, implemented through `note_tags`.

## 3. Column definitions

| Table | Column | Type | Constraints / purpose |
|---|---|---|---|
| users | id | UUID | Primary key |
| users | email | VARCHAR(320) | Required, unique login identifier |
| users | display_name | VARCHAR(100) | Required display name |
| users | password_hash | TEXT | Required hash; never store plaintext passwords |
| users | created_at | TIMESTAMPTZ | Required creation time |
| notes | id | UUID | Primary key |
| notes | user_id | UUID | Required FK to `users.id`, `ON DELETE CASCADE` |
| notes | title | VARCHAR(100) | Required, non-empty title |
| notes | body | TEXT | Optional note body |
| notes | created_at | TIMESTAMPTZ | Required creation time |
| notes | updated_at | TIMESTAMPTZ | Required last update time |
| tags | id | UUID | Primary key |
| tags | user_id | UUID | Required FK to `users.id`, `ON DELETE CASCADE` |
| tags | name | VARCHAR(50) | Required tag label |
| tags | created_at | TIMESTAMPTZ | Required creation time |
| note_tags | note_id | UUID | FK to `notes.id`, `ON DELETE CASCADE` |
| note_tags | tag_id | UUID | FK to `tags.id`, `ON DELETE CASCADE` |
| note_tags | added_at | TIMESTAMPTZ | Required association creation time |

## 4. CREATE TABLE statements

The following DDL targets PostgreSQL.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 100),
    body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tags_user_name UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (note_id, tag_id)
);
```

`gen_random_uuid()` is available in current PostgreSQL releases. The application should update `updated_at` whenever a note is modified, either in application logic or with a database trigger. When attaching a tag, the service must also verify that the tag and note belong to the same user.

## 5. Indexes

```sql
-- Efficiently list one user's notes newest first.
CREATE INDEX idx_notes_user_created
    ON notes (user_id, created_at DESC);

-- Efficiently find notes by tag and then join back to notes.
CREATE INDEX idx_note_tags_tag
    ON note_tags (tag_id, note_id);
```

The primary key on `note_tags(note_id, tag_id)` already indexes the note-first access path. The additional index supports tag-first lookups. The unique constraints on user email and `(user_id, name)` also create indexes in PostgreSQL.

## 6. Example SQL queries

### Query 1: List the latest notes for one user

```sql
SELECT id, title, body, created_at, updated_at
FROM notes
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 20;
```

### Query 2: Find notes tagged “study” (JOIN)

```sql
SELECT n.id, n.title, n.body, n.created_at
FROM notes AS n
JOIN note_tags AS nt ON nt.note_id = n.id
JOIN tags AS t ON t.id = nt.tag_id
WHERE n.user_id = $1
  AND t.user_id = $1
  AND lower(t.name) = lower($2)
ORDER BY n.created_at DESC;
```

The application should pass user ID and tag name as bound parameters, not concatenate user input into SQL.

### Query 3: Create a note and return it

```sql
INSERT INTO notes (user_id, title, body)
VALUES ($1, $2, $3)
RETURNING id, user_id, title, body, created_at, updated_at;
```

### Query 4: Count notes for each user

```sql
SELECT u.id, u.display_name, COUNT(n.id) AS note_count
FROM users AS u
LEFT JOIN notes AS n ON n.user_id = u.id
GROUP BY u.id, u.display_name
ORDER BY note_count DESC;
```

## 7. SQL versus NoSQL justification

SQL is the better default for QuickNotes because the core domain contains connected entities and requires consistent ownership and tag associations. Foreign keys, unique constraints and transactions help prevent orphaned notes and duplicate tag links. PostgreSQL can scale vertically, use indexes and read replicas, and partition tables if measurements later justify it. A document or key-value store could be useful for a specific high-volume feature, but adopting NoSQL for the core data would not remove the need to design ownership, consistency, indexes and access patterns.
