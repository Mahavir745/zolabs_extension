function renderValue(value) {
  if (value === null || value === undefined || value === "") return "Not captured";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ReviewResult({
  result,
  onCreateRecord,
  creatingRecord,
  recordId
}) {
  const entries = Object.entries(result?.parsedAnswers || {});

  return (
    <section className="card">
      <p className="eyebrow">Call completed</p>
      <h2>Review extracted information</h2>

      {result?.summary ? <p className="summary-box">{result.summary}</p> : null}

      <div className="result-list">
        {entries.map(([key, value]) => (
          <div className="result-row" key={key}>
            <span>{key}</span>
            <strong>{renderValue(value)}</strong>
          </div>
        ))}
      </div>

      {result?.unresolvedFields?.length ? (
        <div className="warning-box">
          Missing required fields: {result.unresolvedFields.join(", ")}
        </div>
      ) : null}

      <details className="transcript">
        <summary>View transcript</summary>
        <p>{result?.transcript || "Transcript not available."}</p>
      </details>

      {recordId ? (
        <div className="success-box">Creator record created: {recordId}</div>
      ) : (
        <button
          type="button"
          className="primary-button"
          onClick={onCreateRecord}
          disabled={creatingRecord || result?.unresolvedFields?.length > 0}
        >
          {creatingRecord ? "Creating record…" : "Create Creator record"}
        </button>
      )}
    </section>
  );
}
