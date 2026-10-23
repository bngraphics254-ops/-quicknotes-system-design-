# QuickNotes System Design

QuickNotes is a learning project for the Web Foundations & System Design course. It demonstrates a browser-based API client and documents how a production note-taking service could be designed for one million registered users.

## Features

- Load up to 10 example notes from JSONPlaceholder with `GET`.
- Create a note with `POST`, including title validation (required, maximum 100 characters).
- Delete a note with `DELETE`.
- Display loading, success, error and empty states.
- Disable action buttons while requests are running.
- Render user-provided text with `textContent` rather than interpreting it as HTML.
- Document the real API design, relational data model and scalable architecture.

> **Important demo limitation:** The frontend uses JSONPlaceholder, a practice API. It simulates POST and DELETE responses but does not persist the created or deleted records on its server. The client therefore updates its in-memory list for the current page session. This is not a production persistence strategy.

## Project structure

```text
quicknotes-system-design/
├── index.html
├── style.css
├── api.js
├── README.md
└── docs/
    ├── api-design.md
    ├── data-model.md
    └── architecture.md
```

## How to run the API client

### Option 1: VS Code Live Server

1. Clone or download this repository.
2. Open the project folder in Visual Studio Code.
3. Install the **Live Server** extension if it is not already installed.
4. Right-click `index.html` and select **Open with Live Server**.
5. Click **Load notes**. You need an internet connection to access JSONPlaceholder.

### Option 2: Python local web server

From the project directory, run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. Stop the server with `Ctrl+C`.

The app uses browser `fetch()` to contact `https://jsonplaceholder.typicode.com/posts`. No backend server or package installation is required for this demo. If the API is unavailable, the page should display a friendly error status.

## Design documents

- [API design](docs/api-design.md) — endpoint catalogue, JSON examples, HTTP status codes and error response shape.
- [Data model](docs/data-model.md) — users, notes, tags and note_tags schema, SQL, relationships and indexes.
- [Architecture](docs/architecture.md) — requirements, one-million-user load estimates, architecture diagram, request flows, trade-offs and resilience.

## Technology

- HTML5
- CSS3
- JavaScript (Fetch API, async/await)
- JSONPlaceholder practice API
- PostgreSQL proposed for the production data model

## What I learned

1. How to call an HTTP API with `fetch()` and `async`/`await`, check response status and handle network/server errors with `try`, `catch` and `finally`.
2. How to validate form input, provide accessible loading/success/error/empty feedback, disable buttons during requests and safely display text using `textContent`.
3. How REST endpoints, HTTP methods and status codes define a clear contract between frontend and backend.
4. How primary keys, foreign keys, join tables, constraints and indexes represent relationships and support efficient SQL queries.
5. How to estimate average and peak traffic, and how caching, load balancing, read replicas, queues and redundant components support scalability and availability.
6. Why a practice API's simulated writes must not be mistaken for durable storage in a real application.

## Git history and submission

The assignment requires at least five meaningful commits. Suggested sequence:

1. `Add API client with GET`
2. `Add create note with POST`
3. `Add delete with DELETE`
4. `Add API design doc`
5. `Add data model doc`
6. `Add architecture doc`
7. `Add README`

Push the completed repository to GitHub and submit its public URL. The Day 8 presentation is graded separately.
