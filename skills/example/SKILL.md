# Example Skill

This is an example skill for MIX.

## Trigger

- `/hello`
- `say hello`

## Description

A simple greeting skill that responds with a friendly message.

## Handler

```python
async def run(args: dict) -> str:
    name = args.get("name", "friend")
    return f"Hello, {name}! Welcome to MIX."
```
