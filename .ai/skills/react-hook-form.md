# React Hook Form

## Preferred Patterns
- Initialize one form instance with complete `defaultValues`.
- Use `register` for native-compatible controls and `Controller` for controlled third-party components.
- Connect controlled fields through `field.value`, `field.onChange`, `field.onBlur`, and `field.ref` where supported.
- Reset only at deliberate lifecycle points such as confirmed success or explicit cancellation.

## Pitfalls
- Mixing `watch`/`setValue` wiring with a component that has its own conflicting value lifecycle.
- Reset effects tied to unstable dependencies.
- Recreating forms through changing keys or conditional ownership.
