import { useMemo, useState } from "react";

export default function FormSelector({ forms, onSelect, loading }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return forms;
    return forms.filter((form) =>
      `${form.display_name || ""} ${form.link_name || ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [forms, query]);

  return (
    <section className="card">
      <label className="field-label" htmlFor="form-search">
        Creator form
      </label>
      <input
        id="form-search"
        className="text-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Creator forms"
      />

      <div className="form-grid">
        {loading ? <p className="muted">Loading forms…</p> : null}
        {!loading && filtered.length === 0 ? (
          <p className="muted">No forms found.</p>
        ) : null}

        {filtered.map((form) => (
          <button
            type="button"
            className="form-card"
            key={form.link_name}
            onClick={() => onSelect(form)}
          >
            <strong>{form.display_name || form.link_name}</strong>
            <span>{form.link_name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
