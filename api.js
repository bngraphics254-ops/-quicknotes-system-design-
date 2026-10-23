const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadButton = document.querySelector("#load-btn");
const statusElement = document.querySelector("#status");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitButton = document.querySelector("#submit-btn");
const notesList = document.querySelector("#notes-list");
const noteCount = document.querySelector("#note-count");

let localNotes = [];
let localOnlyIds = new Set();
let nextLocalId = -1;

/**
 * Shared request helper. It throws when the network fails or the server
 * returns a non-success HTTP status, so callers can handle errors consistently.
 */
async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`The server returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  // JSONPlaceholder may return an empty body for DELETE.
  if (response.status === 204) {
    return { status: response.status, data: null };
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  return { status: response.status, data };
}

function setStatus(message, type = "info") {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
}

function updateCount() {
  noteCount.textContent = String(localNotes.length);
}

function showEmptyState() {
  if (localNotes.length !== 0) return;
  const item = document.createElement("li");
  item.className = "empty-item";
  item.textContent = "No notes to show yet. Load notes from the server or create your first note.";
  notesList.replaceChildren(item);
}

function renderNotes() {
  notesList.replaceChildren();

  if (localNotes.length === 0) {
    showEmptyState();
    updateCount();
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const note of localNotes) {
    const item = document.createElement("li");
    item.className = "note-card";

    const heading = document.createElement("h3");
    heading.textContent = note.title || "(Untitled note)";

    const body = document.createElement("p");
    body.textContent = note.body || "No body provided.";

    const meta = document.createElement("div");
    meta.className = "note-meta";

    const idLabel = document.createElement("span");
    idLabel.textContent = `Note ID: ${note.id}`;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete note ${note.id}`);
    deleteButton.addEventListener("click", () => deleteNote(note.id, deleteButton));

    meta.append(idLabel, deleteButton);
    item.append(heading, body, meta);
    fragment.append(item);
  }

  notesList.append(fragment);
  updateCount();
}

async function loadNotes() {
  loadButton.disabled = true;
  submitButton.disabled = true;
  setStatus("Loading notes...");

  try {
    const result = await request(`${API_URL}?_limit=10`);
    localNotes = Array.isArray(result.data) ? result.data : [];
    localOnlyIds = new Set();
    renderNotes();

    if (localNotes.length === 0) {
      setStatus("The server returned no notes.", "success");
    } else {
      setStatus(`Loaded ${localNotes.length} notes from the server.`, "success");
    }
  } catch (error) {
    setStatus(`Could not load notes. ${friendlyError(error)}`, "error");
    if (localNotes.length === 0) showEmptyState();
  } finally {
    loadButton.disabled = false;
    submitButton.disabled = false;
  }
}

function friendlyError(error) {
  if (error instanceof TypeError) {
    return "Please check your internet connection and try again.";
  }
  if (error.status) {
    return `The request failed (HTTP ${error.status}). Please try again.`;
  }
  return "Something went wrong. Please try again.";
}

async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title) {
    setStatus("Please enter a title before creating a note.", "error");
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus("The title must be 100 characters or fewer.", "error");
    titleInput.focus();
    return;
  }

  submitButton.disabled = true;
  loadButton.disabled = true;
  setStatus("Creating note...");

  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title, body, userId: 1 })
    });

    if (!result.data) {
      throw new Error("The server did not return the created note.");
    }

    // JSONPlaceholder returns a simulated ID and does not persist this record.
    // Keep the returned note in this page's memory so it can be displayed and
    // removed during the current session without claiming it was saved permanently.
    const createdNote = { ...result.data, title, body };
    localNotes.unshift(createdNote);
    localOnlyIds.add(createdNote.id);
    renderNotes();
    noteForm.reset();
    setStatus(`Note created (status ${result.status}, id ${createdNote.id}). This demo keeps the note in this page only.`, "success");
  } catch (error) {
    setStatus(`Could not create the note. ${friendlyError(error)}`, "error");
  } finally {
    submitButton.disabled = false;
    loadButton.disabled = false;
  }
}

async function deleteNote(id, button) {
  const noteWasLocalOnly = localOnlyIds.has(id);
  button.disabled = true;
  loadButton.disabled = true;
  submitButton.disabled = true;
  setStatus("Deleting note...");

  try {
    // Even a simulated JSONPlaceholder create is sent through DELETE as required.
    // JSONPlaceholder does not persist POSTed records; on success we remove the
    // note from this page's local state only.
    const result = await request(`${API_URL}/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    localNotes = localNotes.filter(note => String(note.id) !== String(id));
    localOnlyIds.delete(id);
    renderNotes();
    const suffix = noteWasLocalOnly
      ? " It was removed from this page; JSONPlaceholder does not store created notes."
      : "";
    setStatus(`Note ${id} deleted successfully (status ${result.status}).${suffix}`, "success");
  } catch (error) {
    setStatus(`Could not delete note ${id}. ${friendlyError(error)}`, "error");
    button.disabled = false;
  } finally {
    loadButton.disabled = false;
    submitButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);

// The list starts empty and shows a helpful empty state until the first load.
showEmptyState();
updateCount();
