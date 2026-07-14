import { useCallback, useRef, useState } from "react";

export function useSpeechInput({ language = "en-IN", timeoutMs = 12000 } = {}) {
  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const start = useCallback(
    (onResult) => {
      const Recognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!Recognition) {
        setError("Speech recognition is not supported in this browser.");
        return;
      }

      stop();
      setError("");

      const recognition = new Recognition();
      recognition.lang = language;
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) onResult?.(transcript);
        stop();
      };

      recognition.onerror = (event) => {
        setError(event.error || "Microphone error");
        stop();
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);

      timeoutRef.current = window.setTimeout(stop, timeoutMs);
    },
    [language, stop, timeoutMs]
  );

  return { isListening, error, start, stop };
}
