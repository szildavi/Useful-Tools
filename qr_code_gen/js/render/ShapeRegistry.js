/**
 * A named catalogue of shapes. Keeps shape lookup and the list shown in the
 * user interface in one place, so a new shape only has to be registered once.
 */
class ShapeRegistry {
  constructor(entries) {
    this.entries = entries;
  }

  create(name) {
    const entry = this.entries.find((candidate) => candidate.name === name);
    if (!entry) {
      throw new Error(`Unknown shape: ${name}`);
    }
    return entry.build();
  }

  listOptions() {
    return this.entries.map(({ name, label }) => ({ name, label }));
  }

  get defaultName() {
    return this.entries[0].name;
  }
}
