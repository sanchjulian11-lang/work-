# Workflow Studio

A local browser app for mapping recurring tasks and identifying AI and automation opportunities. Suggestions are simple rules, not AI-generated recommendations. No external accounts or API keys are required.

## Run

From `/workspace/work-`:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open the served page in a browser when your development environment supports browser access. Cloud onboarding does not provide a public preview URL.

Entries live in browser local storage. Export them to retain a backup. The app does not execute automations, send messages, or call an AI service.

## Next steps

Capture a typical workday, the tools involved, and a few recurring tasks. Pick one high-effort workflow, establish a time and quality baseline, and implement an integration after its requirements are clear.
