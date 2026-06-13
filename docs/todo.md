# TODO

## Product direction

- Re-evaluate whether the editor is meaningfully faster than hand-writing animation code.
- Keep testing the core value proposition against real production tasks, not just internal consistency.
- Watch for the failure mode where the data model becomes more complex than plain CSS/SCSS authoring.

## Authoring model

- Replace the current fixed transform fields with an ordered transform list model.
- Preserve transform order explicitly so matrix multiplication order is controlled by authored sequence.
- Migrate from the current `x / y / scale / rotate / opacity` style model to a list-based transform representation.
- Explore a minimal transform item set first: `translate`, `scale`, `rotate`, `skew`.

## Preview

- Decide how far preview should go beyond the current lightweight DOM replay.
- Confirm whether animation-name based target discovery is reliable enough in real sites.
- Evaluate whether preview should expose clearer feedback when multiple targets share the same animation name.

## UX

- Validate that the editor still feels faster than direct editing once more transform types are added.
- Avoid growing the UI into a slower abstraction than writing CSS/SCSS by hand.
