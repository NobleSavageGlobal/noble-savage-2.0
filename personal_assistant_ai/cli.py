"""CLI entrypoint for the assistant."""

from personal_assistant_ai.assistant import PersonalAssistant


def main() -> None:
    assistant = PersonalAssistant()
    print("Personal Assistant AI")
    print("Type 'help' for commands. Type 'exit' to quit.")

    while True:
        try:
            user_input = input("> ")
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        response = assistant.respond(user_input)
        print(response)

        if response == "Goodbye!":
            break


if __name__ == "__main__":
    main()
