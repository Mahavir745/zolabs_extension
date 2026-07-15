import { useCallback, useRef, useState } from "react";

export function useSpeechInput({ language = "en-IN" } = {}) {
  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");
  const shouldListenRef = useRef(false);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    window.clearTimeout(timeoutRef.current);
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const clearError = useCallback(() => setError(""), []);

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

      shouldListenRef.current = true;
      let fullTranscript = "";
      let currentInterim = "";

      const initAndStart = () => {
        if (!shouldListenRef.current) return;

        const recognition = new Recognition();
        recognition.lang = language;
        recognition.interimResults = true;
        recognition.continuous = false; // Bypass the Chrome "network" error bug
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          let sessionTranscript = "";
          let isFinal = false;

          for (let i = 0; i < event.results.length; ++i) {
            sessionTranscript += event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              isFinal = true;
            }
          }

          currentInterim = sessionTranscript;
          
          const combined = (fullTranscript + " " + currentInterim).trim();
          if (combined) {
            onResult?.(combined);
          }

          if (isFinal) {
            fullTranscript = (fullTranscript + " " + currentInterim).trim();
            currentInterim = "";
          }
        };

        recognition.onerror = (event) => {
          if (event.error === 'no-speech') return;
          
          // If we got a network error but we are auto-restarting, it's just Chrome being flaky.
          if (event.error === 'network') {
             // We'll let onend handle the restart naturally
             return;
          }

          shouldListenRef.current = false;
          let errorMsg = "Microphone error";
          switch (event.error) {
            case "not-allowed":
            case "service-not-allowed":
              errorMsg = "Microphone access was denied. Please allow microphone permissions in your browser settings.";
              break;
            case "audio-capture":
              errorMsg = "No microphone was found. Ensure your microphone is plugged in and working.";
              break;
            case "aborted":
              return; // Ignore manual aborts
            default:
              errorMsg = `Microphone error: ${event.error}`;
          }
          setError(errorMsg);
          stop();
        };

        recognition.onend = () => {
          if (shouldListenRef.current) {
            if (currentInterim) {
              fullTranscript = (fullTranscript + " " + currentInterim).trim();
              currentInterim = "";
            }
            // Add a slight delay before restarting to prevent InvalidStateError in some browsers
            setTimeout(() => {
              try {
                initAndStart();
              } catch (e) {
                stop();
              }
            }, 50);
          } else {
            setIsListening(false);
          }
        };

        recognitionRef.current = recognition;
        try {
          recognition.start();
          setIsListening(true);
        } catch (e) {
          // Ignore start errors
        }
      };

      initAndStart();
    },
    [language, stop]
  );

  return { isListening, error, start, stop, clearError };
}
