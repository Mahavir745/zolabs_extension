import { useCallback, useRef, useState } from "react";

export function useSpeechInput({ language = "en-IN", timeoutMs = 30000 } = {}) {
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
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        
        const finalTranscript = transcript.trim();
        if (finalTranscript) {
          onResult?.(finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
          let errorMsg = "Microphone error";
          switch (event.error) {
            case "network":
              errorMsg = "Speech recognition failed due to a network error. Please check your internet connection.";
              break;
            case "not-allowed":
            case "service-not-allowed":
              errorMsg = "Microphone access was denied. Please allow microphone permissions in your browser settings.";
              break;
            case "audio-capture":
              errorMsg = "No microphone was found. Ensure your microphone is plugged in and working.";
              break;
            case "aborted":
              errorMsg = "Speech recognition was aborted.";
              break;
            default:
              errorMsg = `Microphone error: ${event.error}`;
          }
          setError(errorMsg);
        }
        stop();
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);

      // Extend timeout to 30 seconds for longer dictation
      timeoutRef.current = window.setTimeout(stop, timeoutMs);
    },
    [language, stop, timeoutMs]
  );

  const clearError = useCallback(() => setError(""), []);

  return { isListening, error, start, stop, clearError };
}
