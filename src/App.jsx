import React, { useState, useRef, useEffect } from "react";
import { Camera, X, Trash2, RotateCcw, Circle, Hand, Zap } from "lucide-react";

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

  // Refs untuk logic deteksi
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const detectionStateRef = useRef({
    currentGesture: null,
    gestureStartTime: 0,
    lastDetectionTime: 0,
    predictionBuffer: [],
    sequence: [],
  });

  // Konfigurasi
  const CONFIG = {
    CONFIDENCE_THRESHOLD: 0.82,
    HOLD_DURATION: 1000, // ms
    COOLDOWN_DURATION: 1800, // ms
    BUFFER_SIZE: 8,
  };

  // ────────────────────────────────────────────────
  //  Fungsi klasifikasi gesture (masih mock — ganti dengan model asli)
  // ────────────────────────────────────────────────
  const classifyGesture = (landmarks) => {
    if (!landmarks || landmarks.length === 0) return null;

    const features = extractFeatures(landmarks[0]);
    const prediction = mockPredict(features);

    return prediction;
  };

  const extractFeatures = (handLandmarks) => {
    const features = [];
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

  const mockPredict = (features) => {
    const tipDistances = features.slice(63, 68);
    const avgDistance =
      tipDistances.reduce((a, b) => a + b, 0) / tipDistances.length;

    const mockProbs = {};
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((letter) => {
      mockProbs[letter] = Math.random() * 0.5;
    });

    let selectedGesture;
    if (avgDistance < 0.15) {
      selectedGesture = "A";
      mockProbs["A"] = 0.85 + Math.random() * 0.1;
    } else if (avgDistance < 0.25) {
      selectedGesture = "B";
      mockProbs["B"] = 0.8 + Math.random() * 0.15;
    } else {
      selectedGesture = "C";
      mockProbs["C"] = 0.75 + Math.random() * 0.2;
    }

    const sum = Object.values(mockProbs).reduce((a, b) => a + b, 0);
    Object.keys(mockProbs).forEach((key) => {
      mockProbs[key] /= sum;
    });

    return {
      gesture: selectedGesture,
      confidence: mockProbs[selectedGesture],
      probabilities: mockProbs,
    };
  };

  // ────────────────────────────────────────────────
  //  Proses prediksi → sequence
  // ────────────────────────────────────────────────
  const processPrediction = (gesture, conf) => {
    const state = detectionStateRef.current;
    const now = Date.now();

    if (conf >= CONFIG.CONFIDENCE_THRESHOLD) {
      state.predictionBuffer.push(gesture);
      if (state.predictionBuffer.length > CONFIG.BUFFER_SIZE) {
        state.predictionBuffer.shift();
      }
    } else {
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

  // ────────────────────────────────────────────────
  //  Inisialisasi MediaPipe Hands + Camera
  // ────────────────────────────────────────────────
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
          minDetectionConfidence: 0.7,
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

  // ────────────────────────────────────────────────
  //  Fungsi utama pengolahan hasil deteksi
  //  ── flip gambar 2x agar landmark sesuai tampilan non-mirror
  // ────────────────────────────────────────────────
  const onResults = (results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Flip horizontal → agar tampilan seperti orang lain lihat (non-mirror)
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    // Kembalikan koordinat landmark ke sistem non-mirror
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

      // Prediksi gesture (gunakan landmarks asli — sudah benar karena input ke model di-flip)
      const prediction = classifyGesture(results.multiHandLandmarks);

      if (prediction) {
        setCurrentGesture(prediction.gesture);
        setConfidence(prediction.confidence);
        setProbabilities(prediction.probabilities);
        processPrediction(prediction.gesture, prediction.confidence);
      }
    } else {
      setHandsCount(0);
      setCurrentGesture(null);
      setConfidence(0);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white p-6">
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Hand className="w-10 h-10" />
              SIBI Sign Language Detection
            </h1>
            <p className="text-gray-300 mt-2">
              Real-time A-Z Detection | Non-mirrored
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`px-4 py-2 rounded-lg ${isModelLoaded ? "bg-green-600" : "bg-yellow-600"}`}
            >
              <Zap className="w-5 h-5 inline mr-2" />
              {isModelLoaded ? "Model Loaded" : "Loading..."}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            {/* Overlay deteksi */}
            <div className="absolute top-4 left-4 right-4">
              <div className="bg-black bg-opacity-75 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    {currentGesture &&
                    confidence >= CONFIG.CONFIDENCE_THRESHOLD ? (
                      <div className="text-3xl font-bold text-green-400">
                        Current: {currentGesture}
                      </div>
                    ) : currentGesture ? (
                      <div className="text-2xl font-bold text-orange-400">
                        Detecting: {currentGesture}
                      </div>
                    ) : (
                      <div className="text-2xl text-gray-400">
                        No gesture detected
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Hand className="w-6 h-6" />
                    <span className="text-lg">{handsCount}</span>
                  </div>
                </div>

                {currentGesture && (
                  <div className="text-sm text-gray-300 mb-2">
                    Confidence: {(confidence * 100).toFixed(1)}%
                  </div>
                )}

                {holdProgress > 0 ? (
                  <div className="mb-2">
                    <div className="text-xs text-gray-400 mb-1">
                      Hold Progress
                    </div>
                    <div className="h-6 bg-gray-700 rounded-full overflow-hidden">
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
                    <div className="h-6 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all duration-100"
                        style={{ width: `${cooldownProgress * 100}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Sequence */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-black bg-opacity-75 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-2">
                  Detected Sequence:
                </div>
                <div className="text-3xl font-bold text-green-400 min-h-[40px]">
                  {detectedSequence || "(empty)"}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={clearSequence}
                    className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                  <button
                    onClick={undoLast}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Undo
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-blue-900 bg-opacity-50 rounded-xl p-4">
            <h3 className="font-bold mb-2">📋 Petunjuk:</h3>
            <ul className="text-sm space-y-1 text-gray-300">
              <li>• Tahan gesture ~1 detik agar terdaftar</li>
              <li>• Tunggu cooldown sebelum gesture berikutnya</li>
              <li>• Kamera tidak mirror (seperti orang lain melihat)</li>
              <li>• Landmark sudah disesuaikan posisinya</li>
            </ul>
          </div>
        </div>

        {/* Panel probabilitas & stats */}
        <div className="space-y-4">
          <div className="bg-gray-800 bg-opacity-75 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
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
                    <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
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

          <div className="bg-gray-800 bg-opacity-75 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4">📊 Stats</h3>
            <div className="space-y-3">
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
            </div>
          </div>

          <div className="bg-yellow-900 bg-opacity-50 rounded-xl p-4 text-sm">
            <p className="font-bold mb-2">⚠️ Catatan:</p>
            <p className="text-gray-300">
              Prediksi masih menggunakan mock. Ganti fungsi{" "}
              <code className="bg-black px-1 rounded">mockPredict()</code>{" "}
              dengan model machine learning asli Anda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Koneksi tangan MediaPipe (harus di window scope)
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