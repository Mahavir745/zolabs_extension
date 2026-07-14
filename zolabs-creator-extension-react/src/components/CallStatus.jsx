const labels = {
  queued: "Queued",
  calling: "Calling",
  ringing: "Ringing",
  connected: "Connected",
  processing: "Processing transcript",
  completed: "Completed",
  failed: "Failed",
  no_answer: "No answer",
  busy: "Busy"
};

export default function CallStatus({ status, durationSeconds, phoneNumber }) {
  return (
    <section className="call-status card">
      <div className={`status-orb status-${status || "queued"}`} />
      <div>
        <p className="eyebrow">Live call status</p>
        <h2>{labels[status] || status || "Preparing"}</h2>
        <p>{phoneNumber}</p>
        <p className="muted">Duration: {durationSeconds || 0}s</p>
      </div>
    </section>
  );
}
