# API Specification (Shared Contract)

This document is the **Single Source of Truth** for API contracts between Frontend and Backend.
Whenever an `XREQ` in `AGENTS.md` is fulfilled and verified, its contract is formally promoted here.

---

## 1. Conventions & Base URLs

- **Local Backend Base URL**: `http://localhost:8000`
- **Development Swagger UI**: `http://localhost:8000/docs`
- **Content Type**: `application/json` (UTF-8)
- **Standard Authentication**: Bearer Token in `Authorization: Bearer <token>` header.

**Every** endpoint, success or error, uses the envelope below. FastAPI validation errors (422) must be remapped to the error envelope with `code: "VALIDATION_ERROR"`.

### Standard Response Envelope (Success)
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

### Standard Response Envelope (Error)
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Detailed explanation of the error",
    "details": {}
  }
}
```

---

## 2. Core Endpoints

*Status legend: `PLANNED` (agreed, not built) · `MOCKED` (frontend mock exists) · `LIVE` (backend implemented, Swagger-verified).*

### 2.1 Auth & Session

#### `POST /api/auth/login` — `PLANNED`
- **Description**: Authenticate user with credentials and return JWT session.
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "secretpassword"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "token": "jwt_token_string",
      "user": {
        "id": "usr_101",
        "name": "Minhaz",
        "email": "user@example.com",
        "role": "admin"
      }
    },
    "message": "Login successful"
  }
  ```
- **Error (401 Unauthorized)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_CREDENTIALS",
      "message": "Invalid email or password",
      "details": {}
    }
  }
  ```

---

### 2.2 Health Check

#### `GET /api/health` — `PLANNED`
- **Description**: Basic server status and ping.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "status": "healthy",
      "timestamp": "2026-11-14T19:30:00Z"
    },
    "message": "ok"
  }
  ```

---

## 3. How to Update This Specification

1. When a new feature or endpoint is needed during active development, **file an `XREQ` in [AGENTS.md](../AGENTS.md)**.
2. The Backend team implements the route and marks `[RESOLVED]`.
3. Once the Frontend validates integration, the endpoint contract is documented into this file for permanent record and its status set to `LIVE`.
4. Agents: load `.claude/skills/openapi-spec-generation` before editing this file. Keep it in sync with the backend's `/openapi.json`.
