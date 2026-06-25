import unittest

from personal_assistant_ai import PersonalAssistant


class PersonalAssistantTests(unittest.TestCase):
    def setUp(self) -> None:
        self.assistant = PersonalAssistant()

    def test_help_command(self) -> None:
        response = self.assistant.respond("help")
        self.assertIn("Available commands", response)

    def test_status_command(self) -> None:
        self.assertEqual(
            self.assistant.respond("status"),
            "Assistant is running and ready.",
        )

    def test_echo_command(self) -> None:
        self.assertEqual(
            self.assistant.respond("echo hello"),
            "hello",
        )

    def test_unknown_command(self) -> None:
        self.assertIn(
            "Unknown command",
            self.assistant.respond("launch rockets"),
        )


if __name__ == "__main__":
    unittest.main()
