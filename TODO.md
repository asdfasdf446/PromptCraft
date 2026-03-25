Act as a Senior Go Engineer. Implement a "JWT Guest/Official Account Dual-Track Login System" for an existing web game backend based on Go + Nano + Redis, and synchronously update the relevant API code and development documentation.

1. Core Tech Stack & Dependencies
Backend Framework: Nano (Go)

Cache & Hot Data: Redis

Account Persistence Library: SQLite (to be created)

Core Dependencies: github.com/golang-jwt/jwt/v5, golang.org/x/crypto/bcrypt

2. Functional Modules & Logic Implementation
2.1 Database & Account Model
Initialize the SQLite database and create a user table containing: id (primary key), username (unique index), and password_hash.

Write the registration logic: obtain the username and password, use bcrypt to salt and hash the password, and store the hash value in SQLite. Never store plain text.

2.2 Dual-Track JWT Issuance Logic
Guest Login API:

Receive a random UUID passed from the frontend.

Issue a JWT with the Payload strictly structured as: {"uid": "passed_UUID", "role": "guest"}.

Initialize the temporary context data for this guest in Redis.

Official Login API:

Query SQLite to verify the username and hashed password.

Upon successful verification, issue a JWT with the Payload strictly structured as: {"uid": "real_user_ID", "role": "user"}.

2.3 Nano Framework Integration & Lifecycle Management
Handshake Authentication: Parse the incoming JWT in the Nano Handler's pre-processing logic or the first route. After verifying the signature is valid, use session.Set() and session.Push() to bind the uid and role to the current connection's *session.Session.

Data Flow Differentiation:

State changes during gameplay must be written to Redis at a high frequency.

Register Nano's session.OnClosed callback function.

When the WebSocket disconnects and triggers the callback, read session.Get("role"):

If guest: Execute the Redis cleanup logic to destroy all temporary data associated with this UUID.

If user: Execute the persistence logic to asynchronously dump the player's core asset data from Redis to the SQLite database.

2.4 API Documentation Update
Update the project documentation, adding/modifying the following content:

Frontend specifications for Guest Mode (UUID stored in sessionStorage and discarded when the tab is closed).

Frontend specifications for Official Accounts (JWT stored in localStorage).

Input and output formats for the HTTP login/registration APIs.

The format and process description for the first data packet carrying the JWT for authentication after establishing a WebSocket connection.

Please scan the current codebase structure and directly generate the corresponding code modification plan, SQL initialization script, and the updated API Markdown documentation. Automatically execute the modifications once confirmed.
