"""Errors shared between the backend and the AI module (API_SPEC §7)."""


class AIUnavailableError(Exception):
    """Raised by AI code (Galib) when the model provider can't be reached."""
