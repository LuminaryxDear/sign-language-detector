import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  X,
  Trash2,
  RotateCcw,
  Circle,
  Hand,
  Zap,
  Smartphone,
  Monitor,
} from "lucide-react";

// MediaPipe Hands Detection (menggunakan CDN)
const MEDIAPIPE_HANDS_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
const MEDIAPIPE_CAMERA_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";

const SignLanguageApp = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detectedSequence, setDetectedSequence] = useState("");
  const [currentGesture, setCurrentGesture] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [handsCount, setHandsCount] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [cooldownProgress, setCooldownProgress] = useState(1);
  const [probabilities, setProbabilities] = useState({});
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [debugMessage, setDebugMessage] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Refs untuk logic deteksi
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const detectionStateRef = useRef({
    currentGesture: null,
    gestureStartTime: 0,
    lastDetectionTime: 0,
    predictionBuffer: [],
    sequence: [],
    noGestureStartTime: 0,
  });

  // Konfigurasi
  const CONFIG = {
    CONFIDENCE_THRESHOLD: 0.3,
    HOLD_DURATION: 500,
    COOLDOWN_DURATION: 1000,
    BUFFER_SIZE: 8,
    NO_GESTURE_SPACE_DURATION: 1500,
  };

  // Deteksi mobile atau desktop
  useEffect(() => {
    const checkMobile = () => {
      const mobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        ) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Force add gesture function
  const forceAddGesture = () => {
    if (currentGesture && confidence > 0.1) {
      detectionStateRef.current.sequence.push(currentGesture);
      setDetectedSequence(detectionStateRef.current.sequence.join(""));
      playDetectionSound();
      setDebugMessage(`Force added: ${currentGesture}`);
    }
  };

  // Keyboard listener for desktop (ENTER key)
  useEffect(() => {
    if (!isMobile) {
      const handleKeyDown = (e) => {
        if (e.key === "Enter") {
          forceAddGesture();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [currentGesture, confidence, isMobile]);

  const classifyGesture = (landmarks) => {
    if (!landmarks || landmarks.length === 0) {
      setDebugMessage("No hands - Dekatkan tangan/lighting bagus");
      return null;
    }

    const numHands = landmarks.length;

    let features1 = extractFeatures(landmarks[0] || []);
    let features2 =
      numHands > 1 ? extractFeatures(landmarks[1]) : new Array(78).fill(0);

    const features = features1.concat(features2);

    const prediction = improvedMockPredict(features, numHands, landmarks);

    return prediction;
  };

  const extractFeatures = (handLandmarks) => {
    const features = [];
    if (handLandmarks.length === 0) return new Array(78).fill(0);

    handLandmarks.forEach((lm) => {
      features.push(lm.x, lm.y, lm.z);
    });

    const wrist = handLandmarks[0];
    const tips = [4, 8, 12, 16, 20];

    tips.forEach((tipIdx) => {
      const tip = handLandmarks[tipIdx];
      const dist = Math.sqrt(
        (tip.x - wrist.x) ** 2 +
          (tip.y - wrist.y) ** 2 +
          (tip.z - wrist.z) ** 2,
      );
      features.push(dist);
    });

    const fingerChains = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 16],
      [17, 18, 19, 20],
    ];

    fingerChains.forEach((chain) => {
      for (let i = 0; i < chain.length - 2; i++) {
        const angle = calculateAngle(
          handLandmarks[chain[i]],
          handLandmarks[chain[i + 1]],
          handLandmarks[chain[i + 2]],
        );
        features.push(angle);
      }
    });

    return features;
  };

  const calculateAngle = (a, b, c) => {
    const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

    const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
    const magBa = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
    const magBc = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);

    const cosAngle = dot / (magBa * magBc + 1e-6);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    return (angle * 180) / Math.PI;
  };

  const improvedMockPredict = (features, numHands, landmarks) => {
    const mockProbs = {};
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((letter) => {
      mockProbs[letter] = Math.random() * 0.2;
    });

    let selectedGesture = null;
    let maxProb = 0.4;

    if (numHands === 1) {
      const hand = landmarks[0];
      const isFingerOpen = (tipIdx, pipIdx) =>
        hand[tipIdx].y < hand[pipIdx].y - 0.05;
      const isFingerCurved = (tipIdx, pipIdx) =>
        hand[tipIdx].y > hand[pipIdx].y;
      const thumbOpen = Math.abs(hand[4].x - hand[3].x) > 0.05;
      const thumbTouchIndex =
        Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y) < 0.05;

      const openFingers = [
        isFingerOpen(8, 6),
        isFingerOpen(12, 10),
        isFingerOpen(16, 14),
        isFingerOpen(20, 18),
      ].filter(Boolean).length;

      if (openFingers === 0 && !thumbOpen) {
        selectedGesture = "A";
        maxProb = 0.8;
      } else if (openFingers === 4 && thumbOpen) {
        selectedGesture = "B";
        maxProb = 0.8;
      } else if (openFingers === 3 && thumbTouchIndex) {
        selectedGesture = "C";
        maxProb = 0.8;
      } else if (openFingers === 1 && thumbOpen && !thumbTouchIndex) {
        selectedGesture = "D";
        maxProb = 0.8;
      } else if (openFingers === 0 && thumbOpen && thumbTouchIndex) {
        selectedGesture = "E";
        maxProb = 0.8;
      } else if (openFingers === 3 && thumbOpen && thumbTouchIndex) {
        selectedGesture = "F";
        maxProb = 0.8;
      } else if (openFingers === 1 && isFingerOpen(8, 6) && thumbOpen) {
        selectedGesture = "G";
        maxProb = 0.7;
      } else if (openFingers === 2 && thumbOpen) {
        selectedGesture = "H";
        maxProb = 0.8;
      } else if (openFingers === 1 && isFingerOpen(20, 18)) {
        selectedGesture = "I";
        maxProb = 0.8;
      } else if (openFingers === 1 && isFingerCurved(20, 18)) {
        selectedGesture = "J";
        maxProb = 0.7;
      } else if (openFingers === 2 && thumbTouchIndex) {
        selectedGesture = "K";
        maxProb = 0.8;
      } else if (openFingers === 1 && thumbOpen && hand[4].y < hand[8].y) {
        selectedGesture = "L";
        maxProb = 0.8;
      } else if (openFingers === 0 && thumbOpen) {
        selectedGesture = "M";
        maxProb = 0.8;
      } else if (openFingers === 0) {
        selectedGesture = "N";
        maxProb = 0.7;
      } else if (thumbTouchIndex && openFingers === 0) {
        selectedGesture = "O";
        maxProb = 0.8;
      } else if (openFingers === 2 && isFingerCurved(8, 6)) {
        selectedGesture = "P";
        maxProb = 0.7;
      } else if (openFingers === 1 && thumbTouchIndex) {
        selectedGesture = "Q";
        maxProb = 0.7;
      } else if (openFingers === 2 && hand[8].x > hand[12].x) {
        selectedGesture = "R";
        maxProb = 0.8;
      } else if (openFingers === 0 && thumbOpen) {
        selectedGesture = "S";
        maxProb = 0.8;
      } else if (openFingers === 1 && thumbTouchIndex) {
        selectedGesture = "T";
        maxProb = 0.8;
      } else if (openFingers === 2) {
        selectedGesture = "U";
        maxProb = 0.8;
      } else if (openFingers === 2 && hand[8].x < hand[12].x - 0.05) {
        selectedGesture = "V";
        maxProb = 0.8;
      } else if (openFingers === 3) {
        selectedGesture = "W";
        maxProb = 0.8;
      } else if (openFingers === 1 && isFingerCurved(8, 6)) {
        selectedGesture = "X";
        maxProb = 0.8;
      } else if (openFingers === 1 && thumbOpen && isFingerOpen(20, 18)) {
        selectedGesture = "Y";
        maxProb = 0.8;
      } else if (openFingers === 1 && Math.abs(hand[8].x - hand[0].x) > 0.1) {
        selectedGesture = "Z";
        maxProb = 0.7;
      } else {
        const avgDist = features.slice(63, 68).reduce((a, b) => a + b, 0) / 5;
        const index = Math.min(25, Math.floor(avgDist * 52));
        selectedGesture = String.fromCharCode(65 + index);
        maxProb = 0.5;
      }
    } else {
      const distBetweenWrists = Math.sqrt(
        (landmarks[0][0].x - landmarks[1][0].x) ** 2 +
          (landmarks[0][0].y - landmarks[1][0].y) ** 2,
      );
      const twoHandLetters = ["M", "N", "P", "Q"];
      const index =
        Math.floor(distBetweenWrists * twoHandLetters.length) %
        twoHandLetters.length;
      selectedGesture = twoHandLetters[index];
      maxProb = 0.7;
    }

    if (selectedGesture) {
      mockProbs[selectedGesture] = maxProb + Math.random() * 0.1;
      setDebugMessage(`Detected ${selectedGesture} with rule match`);
    } else {
      setDebugMessage("No match - Coba pose lebih jelas");
    }

    const sum = Object.values(mockProbs).reduce((a, b) => a + b, 0);
    Object.keys(mockProbs).forEach((key) => {
      mockProbs[key] /= sum;
    });

    return {
      gesture: selectedGesture,
      confidence: mockProbs[selectedGesture] || 0,
      probabilities: mockProbs,
    };
  };

  const processPrediction = (gesture, conf) => {
    const state = detectionStateRef.current;
    const now = Date.now();

    if (conf >= CONFIG.CONFIDENCE_THRESHOLD && gesture) {
      state.predictionBuffer.push(gesture);
      if (state.predictionBuffer.length > CONFIG.BUFFER_SIZE) {
        state.predictionBuffer.shift();
      }
      state.noGestureStartTime = 0;
    } else {
      if (!state.noGestureStartTime) state.noGestureStartTime = now;
      if (
        now - state.noGestureStartTime > CONFIG.NO_GESTURE_SPACE_DURATION &&
        state.sequence.length > 0
      ) {
        state.sequence.push(" ");
        setDetectedSequence(state.sequence.join(""));
        state.noGestureStartTime = now;
      }

      if (state.predictionBuffer.length < CONFIG.BUFFER_SIZE / 2) {
        state.predictionBuffer = [];
        state.currentGesture = null;
      }
      return;
    }

    if (state.predictionBuffer.length < CONFIG.BUFFER_SIZE / 2) return;

    const counts = {};
    state.predictionBuffer.forEach((g) => {
      counts[g] = (counts[g] || 0) + 1;
    });
    const smoothed = Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b,
    );

    if (smoothed === state.currentGesture) {
      const holdTime = now - state.gestureStartTime;
      const progress = Math.min(holdTime / CONFIG.HOLD_DURATION, 1);
      setHoldProgress(progress);

      if (holdTime >= CONFIG.HOLD_DURATION) {
        if (now - state.lastDetectionTime >= CONFIG.COOLDOWN_DURATION) {
          state.sequence.push(smoothed);
          setDetectedSequence(state.sequence.join(""));
          state.lastDetectionTime = now;
          state.currentGesture = null;
          state.predictionBuffer = [];
          setHoldProgress(0);
          playDetectionSound();
        }
      }
    } else {
      state.currentGesture = smoothed;
      state.gestureStartTime = now;
      setHoldProgress(0);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const state = detectionStateRef.current;
      if (state.lastDetectionTime === 0) {
        setCooldownProgress(1);
        return;
      }
      const elapsed = Date.now() - state.lastDetectionTime;
      setCooldownProgress(
        elapsed >= CONFIG.COOLDOWN_DURATION
          ? 1
          : elapsed / CONFIG.COOLDOWN_DURATION,
      );
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const playDetectionSound = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  };

  useEffect(() => {
    const loadMediaPipe = async () => {
      try {
        await loadScript(MEDIAPIPE_HANDS_URL);
        await loadScript(MEDIAPIPE_CAMERA_URL);

        const hands = new window.Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        hands.onResults(onResults);
        handsRef.current = hands;

        if (videoRef.current) {
          const camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              await hands.send({ image: videoRef.current });
            },
            width: 1280,
            height: 720,
          });

          await camera.start();
          cameraRef.current = camera;
        }

        setIsLoading(false);
        setIsModelLoaded(true);
      } catch (err) {
        console.error("Gagal load MediaPipe:", err);
        setIsLoading(false);
      }
    };

    loadMediaPipe();

    return () => {
      if (cameraRef.current) cameraRef.current.stop();
    };
  }, []);

  const loadScript = (url) =>
    new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });

  const onResults = (results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);

    if (results.multiHandLandmarks) {
      setHandsCount(results.multiHandLandmarks.length);

      results.multiHandLandmarks.forEach((landmarks) => {
        drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 5,
        });
        drawLandmarks(ctx, landmarks, {
          color: "#FF0000",
          lineWidth: 2,
        });
      });

      const prediction = classifyGesture(results.multiHandLandmarks);

      if (prediction) {
        setCurrentGesture(prediction.gesture);
        setConfidence(prediction.confidence);
        setProbabilities(prediction.probabilities);
        processPrediction(prediction.gesture, prediction.confidence);
      } else {
        processPrediction(null, 0);
      }
    } else {
      setHandsCount(0);
      setCurrentGesture(null);
      setConfidence(0);
      processPrediction(null, 0);
      setDebugMessage("No landmarks - Gerak pelan/dekatkan tangan");
    }

    ctx.restore();
  };

  const drawConnectors = (ctx, landmarks, connections, style) => {
    connections.forEach(([start, end]) => {
      const a = landmarks[start];
      const b = landmarks[end];
      ctx.beginPath();
      ctx.moveTo(a.x * ctx.canvas.width, a.y * ctx.canvas.height);
      ctx.lineTo(b.x * ctx.canvas.width, b.y * ctx.canvas.height);
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.lineWidth;
      ctx.stroke();
    });
  };

  const drawLandmarks = (ctx, landmarks, style) => {
    landmarks.forEach((lm) => {
      ctx.beginPath();
      ctx.arc(
        lm.x * ctx.canvas.width,
        lm.y * ctx.canvas.height,
        5,
        0,
        2 * Math.PI,
      );
      ctx.fillStyle = style.color;
      ctx.fill();
    });
  };

  const clearSequence = () => {
    detectionStateRef.current.sequence = [];
    setDetectedSequence("");
  };

  const undoLast = () => {
    const state = detectionStateRef.current;
    if (state.sequence.length > 0) {
      state.sequence.pop();
      setDetectedSequence(state.sequence.join(""));
    }
  };

  const sortedProbs = Object.entries(probabilities)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto mb-4 md:mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold flex items-center gap-2 md:gap-3">
              <Hand className="w-6 h-6 md:w-10 md:h-10" />
              BISINDO Sign Language
            </h1>
            <p className="text-gray-300 mt-2 text-sm md:text-base">
              Real-time A-Z Detection |{" "}
              {isMobile ? "📱 Mobile Mode" : "💻 Desktop Mode"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isMobile ? (
              <Smartphone className="w-5 h-5" />
            ) : (
              <Monitor className="w-5 h-5" />
            )}
            <div
              className={`px-3 py-2 rounded-lg text-sm ${isModelLoaded ? "bg-green-600" : "bg-yellow-600"}`}
            >
              <Zap className="w-4 h-4 inline mr-2" />
              {isModelLoaded ? "Ready" : "Loading..."}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <div className="bg-black rounded-2xl overflow-hidden shadow-2xl relative">
            <video ref={videoRef} className="hidden" playsInline />
            <canvas ref={canvasRef} className="w-full h-auto" />

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
                <div className="text-center">
                  <Camera className="w-16 h-16 mx-auto mb-4 animate-pulse" />
                  <p className="text-xl">Initializing camera...</p>
                </div>
              </div>
            )}

            <div className="absolute top-4 left-4 right-4">
              <div className="bg-black bg-opacity-75 rounded-xl p-3 md:p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    {currentGesture &&
                    confidence >= CONFIG.CONFIDENCE_THRESHOLD ? (
                      <div className="text-2xl md:text-3xl font-bold text-green-400">
                        Current: {currentGesture}
                      </div>
                    ) : currentGesture ? (
                      <div className="text-xl md:text-2xl font-bold text-orange-400">
                        Detecting: {currentGesture}
                      </div>
                    ) : (
                      <div className="text-lg md:text-2xl text-gray-400">
                        No gesture
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Hand className="w-5 h-5 md:w-6 md:h-6" />
                    <span className="text-base md:text-lg">{handsCount}</span>
                  </div>
                </div>

                {currentGesture && (
                  <div className="text-xs md:text-sm text-gray-300 mb-2">
                    Confidence: {(confidence * 100).toFixed(1)}%
                  </div>
                )}

                {holdProgress > 0 ? (
                  <div className="mb-2">
                    <div className="text-xs text-gray-400 mb-1">
                      Hold Progress
                    </div>
                    <div className="h-4 md:h-6 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-100"
                        style={{ width: `${holdProgress * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-right text-gray-400 mt-1">
                      {(holdProgress * 100).toFixed(0)}%
                    </div>
                  </div>
                ) : cooldownProgress < 1 ? (
                  <div className="mb-2">
                    <div className="text-xs text-gray-400 mb-1">Cooldown</div>
                    <div className="h-4 md:h-6 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all duration-100"
                        style={{ width: `${cooldownProgress * 100}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-black bg-opacity-75 rounded-xl p-3 md:p-4">
                <div className="text-xs md:text-sm text-gray-400 mb-2">
                  Detected Sequence:
                </div>
                <div className="text-xl md:text-3xl font-bold text-green-400 min-h-[30px] md:min-h-[40px] break-all">
                  {detectedSequence || "(empty)"}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={clearSequence}
                    className="flex-1 bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition text-sm md:text-base"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                  <button
                    onClick={undoLast}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition text-sm md:text-base"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Undo
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tombol ENTER untuk mobile */}
          {isMobile && (
            <div className="mt-4">
              <button
                onClick={forceAddGesture}
                disabled={!currentGesture || confidence < 0.1}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition ${
                  currentGesture && confidence > 0.1
                    ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                <Circle className="w-6 h-6" />
                TAMBAH KE SEQUENCE (ENTER)
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">
                Tap tombol ini untuk force add gesture saat ini
              </p>
            </div>
          )}

          {/* Petunjuk berbeda untuk mobile dan desktop */}
          <div className="mt-4 bg-blue-900 bg-opacity-50 rounded-xl p-4">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              {isMobile ? (
                <Smartphone className="w-5 h-5" />
              ) : (
                <Monitor className="w-5 h-5" />
              )}
              📋 Petunjuk {isMobile ? "Mobile" : "Desktop"}:
            </h3>
            <ul className="text-sm space-y-1 text-gray-300">
              <li>• Tahan gesture ~0.5 detik agar terdaftar otomatis</li>
              <li>• Tunggu cooldown sebelum gesture berikutnya</li>
              <li>• Kamera tidak mirror, landmark disesuaikan</li>
              <li>• Mendukung 1-2 tangan untuk A-Z</li>
              <li>• No gesture 1.5 detik = spasi otomatis</li>
              {isMobile ? (
                <>
                  <li className="text-yellow-300">
                    • 📱 <strong>MOBILE:</strong> Tap tombol "TAMBAH KE
                    SEQUENCE" di bawah kamera untuk force add gesture
                  </li>
                  <li>• Pastikan lighting cukup terang</li>
                  <li>• Pegang HP dengan stabil</li>
                </>
              ) : (
                <>
                  <li className="text-green-300">
                    • 💻 <strong>DESKTOP:</strong> Tekan tombol ENTER pada
                    keyboard untuk force add gesture
                  </li>
                  <li>• Gunakan webcam dengan resolusi baik</li>
                  <li>• Posisi kamera setinggi dada</li>
                </>
              )}
              <li>• Debug: {debugMessage}</li>
            </ul>
          </div>
        </div>

        {/* Panel probabilitas & stats */}
        <div className="space-y-4">
          <div className="bg-gray-800 bg-opacity-75 rounded-xl p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
              <Circle className="w-5 h-5" />
              Probabilities
            </h3>
            <div className="space-y-3">
              {sortedProbs.length > 0 ? (
                sortedProbs.map(([letter, prob]) => (
                  <div key={letter}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-bold">{letter}</span>
                      <span className="text-gray-400">
                        {(prob * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-3 md:h-4 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${prob * 100}%`,
                          background: `linear-gradient(90deg, rgb(${255 - prob * 255}, ${prob * 255}, 100)`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No detections yet
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800 bg-opacity-75 rounded-xl p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-bold mb-4">📊 Stats</h3>
            <div className="space-y-3 text-sm md:text-base">
              <div className="flex justify-between">
                <span className="text-gray-400">Sequence Length:</span>
                <span className="font-bold">{detectedSequence.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Hands Detected:</span>
                <span className="font-bold">{handsCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current Confidence:</span>
                <span className="font-bold">
                  {(confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Device Mode:</span>
                <span className="font-bold">
                  {isMobile ? "📱 Mobile" : "💻 Desktop"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-yellow-900 bg-opacity-50 rounded-xl p-4 text-xs md:text-sm">
            <p className="font-bold mb-2">⚠️ Catatan:</p>
            <p className="text-gray-300">
              Improved dengan lebih banyak rules BISINDO. Ganti mock dengan ML
              asli untuk akurasi 99%.{" "}
              {isMobile
                ? "Mode mobile aktif dengan tombol tap."
                : "Mode desktop aktif dengan shortcut ENTER."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Koneksi tangan MediaPipe
if (typeof window !== "undefined") {
  window.HAND_CONNECTIONS = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [0, 9],
    [9, 10],
    [10, 11],
    [11, 12],
    [0, 13],
    [13, 14],
    [14, 15],
    [15, 16],
    [0, 17],
    [17, 18],
    [18, 19],
    [19, 20],
    [5, 9],
    [9, 13],
    [13, 17],
  ];
}

export default SignLanguageApp;
