"""Core assistant behavior."""


class PersonalAssistant:
    """A tiny command handler you can extend over time."""

    def respond(self, user_input: str) -> str:
        text = (user_input or "").strip()
        if not text:
            return "Please enter a command. Type 'help' for options."

        lowered = text.lower()

        if lowered in {"help", "h", "?"}:
            return (
                "Available commands: help, status, echo <message>, exit"
            )

        if lowered == "status":
            return "Assistant is running and ready."

        if lowered.startswith("echo "):
            return text[5:].strip() or "Nothing to echo."

        if lowered in {"exit", "quit"}:
            return "Goodbye!"

        return (
            "Unknown command. Type 'help' to view supported commands."
        )
