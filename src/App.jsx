import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  Trash2,
  RotateCcw,
  Circle,
  Hand,
  Zap,
  Smartphone,
  Monitor,
  TrendingUp,
  Activity,
  CheckCircle2,
} from "lucide-react";

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
  const [gestureStability, setGestureStability] = useState(0);
  const [recentDetections, setRecentDetections] = useState([]);

  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const detectionStateRef = useRef({
    currentGesture: null,
    gestureStartTime: 0,
    lastDetectionTime: 0,
    predictionBuffer: [],
    sequence: [],
    noGestureStartTime: 0,
    stabilityBuffer: [],
  });

  const CONFIG = {
    CONFIDENCE_THRESHOLD: 0.35,
    HOLD_DURATION: 600,
    COOLDOWN_DURATION: 800,
    BUFFER_SIZE: 10,
    NO_GESTURE_SPACE_DURATION: 1800,
    STABILITY_THRESHOLD: 0.7,
  };

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

  const forceAddGesture = () => {
    if (currentGesture && confidence > 0.2) {
      detectionStateRef.current.sequence.push(currentGesture);
      setDetectedSequence(detectionStateRef.current.sequence.join(""));

      setRecentDetections((prev) => [
        ...prev.slice(-4),
        {
          gesture: currentGesture,
          confidence: confidence,
          timestamp: Date.now(),
        },
      ]);

      playDetectionSound();
      setDebugMessage(`✓ Added: ${currentGesture}`);
    }
  };

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
      setDebugMessage("⚠️ No hands detected");
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
      mockProbs[letter] = Math.random() * 0.15;
    });

    let selectedGesture = null;
    let maxProb = 0.5;

    if (numHands === 1) {
      const hand = landmarks[0];

      const isFingerOpen = (tipIdx, pipIdx) =>
        hand[tipIdx].y < hand[pipIdx].y - 0.04;
      const isFingerClosed = (tipIdx, pipIdx) =>
        hand[tipIdx].y > hand[pipIdx].y + 0.02;
      const thumbOpen = Math.abs(hand[4].x - hand[3].x) > 0.06;
      const thumbClosed = Math.abs(hand[4].x - hand[3].x) < 0.03;
      const thumbTouchIndex =
        Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y) < 0.06;

      const fingerStates = {
        thumb: thumbOpen,
        index: isFingerOpen(8, 6),
        middle: isFingerOpen(12, 10),
        ring: isFingerOpen(16, 14),
        pinky: isFingerOpen(20, 18),
      };

      const openFingers = [
        fingerStates.index,
        fingerStates.middle,
        fingerStates.ring,
        fingerStates.pinky,
      ].filter(Boolean).length;

      // Improved gesture detection dengan lebih strict rules
      if (openFingers === 0 && thumbClosed) {
        selectedGesture = "A";
        maxProb = 0.85;
      } else if (openFingers === 4 && thumbOpen) {
        selectedGesture = "B";
        maxProb = 0.88;
      } else if (openFingers === 3 && !fingerStates.index && thumbOpen) {
        selectedGesture = "C";
        maxProb = 0.82;
      } else if (openFingers === 1 && fingerStates.index && thumbOpen) {
        selectedGesture = "D";
        maxProb = 0.86;
      } else if (openFingers === 0 && thumbOpen) {
        selectedGesture = "E";
        maxProb = 0.83;
      } else if (openFingers === 3 && thumbTouchIndex && !fingerStates.index) {
        selectedGesture = "F";
        maxProb = 0.84;
      } else if (
        openFingers === 1 &&
        fingerStates.index &&
        thumbOpen &&
        hand[8].x > hand[5].x + 0.05
      ) {
        selectedGesture = "G";
        maxProb = 0.78;
      } else if (
        openFingers === 2 &&
        fingerStates.index &&
        fingerStates.middle &&
        thumbOpen
      ) {
        selectedGesture = "H";
        maxProb = 0.87;
      } else if (openFingers === 1 && fingerStates.pinky && !thumbOpen) {
        selectedGesture = "I";
        maxProb = 0.85;
      } else if (
        openFingers === 1 &&
        fingerStates.pinky &&
        hand[20].y > hand[18].y
      ) {
        selectedGesture = "J";
        maxProb = 0.76;
      } else if (
        openFingers === 2 &&
        fingerStates.index &&
        fingerStates.middle &&
        thumbTouchIndex
      ) {
        selectedGesture = "K";
        maxProb = 0.83;
      } else if (
        openFingers === 1 &&
        fingerStates.index &&
        thumbOpen &&
        hand[4].y < hand[8].y - 0.08
      ) {
        selectedGesture = "L";
        maxProb = 0.86;
      } else if (openFingers === 0 && thumbOpen && hand[4].y > hand[8].y) {
        selectedGesture = "M";
        maxProb = 0.82;
      } else if (openFingers === 0 && hand[4].y > hand[6].y) {
        selectedGesture = "N";
        maxProb = 0.79;
      } else if (thumbTouchIndex && openFingers === 0) {
        selectedGesture = "O";
        maxProb = 0.88;
      } else if (
        openFingers === 2 &&
        fingerStates.index &&
        fingerStates.middle &&
        hand[8].y > hand[6].y
      ) {
        selectedGesture = "P";
        maxProb = 0.77;
      } else if (
        openFingers === 1 &&
        fingerStates.index &&
        thumbOpen &&
        hand[8].y > hand[5].y
      ) {
        selectedGesture = "Q";
        maxProb = 0.75;
      } else if (
        openFingers === 2 &&
        fingerStates.index &&
        fingerStates.middle &&
        Math.abs(hand[8].x - hand[12].x) < 0.03
      ) {
        selectedGesture = "R";
        maxProb = 0.84;
      } else if (openFingers === 0 && thumbOpen && hand[4].x > hand[3].x) {
        selectedGesture = "S";
        maxProb = 0.83;
      } else if (
        openFingers === 1 &&
        fingerStates.index &&
        thumbTouchIndex &&
        hand[8].y < hand[5].y
      ) {
        selectedGesture = "T";
        maxProb = 0.81;
      } else if (
        openFingers === 2 &&
        fingerStates.index &&
        fingerStates.middle &&
        !thumbOpen
      ) {
        selectedGesture = "U";
        maxProb = 0.85;
      } else if (
        openFingers === 2 &&
        fingerStates.index &&
        fingerStates.middle &&
        Math.abs(hand[8].x - hand[12].x) > 0.05
      ) {
        selectedGesture = "V";
        maxProb = 0.87;
      } else if (
        openFingers === 3 &&
        fingerStates.index &&
        fingerStates.middle &&
        fingerStates.ring
      ) {
        selectedGesture = "W";
        maxProb = 0.86;
      } else if (
        openFingers === 1 &&
        fingerStates.index &&
        hand[8].y > hand[6].y + 0.04
      ) {
        selectedGesture = "X";
        maxProb = 0.8;
      } else if (openFingers === 1 && fingerStates.pinky && thumbOpen) {
        selectedGesture = "Y";
        maxProb = 0.85;
      } else if (
        openFingers === 1 &&
        fingerStates.index &&
        Math.abs(hand[8].x - hand[0].x) > 0.12
      ) {
        selectedGesture = "Z";
        maxProb = 0.74;
      }
    } else if (numHands === 2) {
      const distBetweenWrists = Math.sqrt(
        (landmarks[0][0].x - landmarks[1][0].x) ** 2 +
          (landmarks[0][0].y - landmarks[1][0].y) ** 2,
      );
      const twoHandLetters = ["M", "N", "P", "Q"];
      const index =
        Math.floor(distBetweenWrists * twoHandLetters.length) %
        twoHandLetters.length;
      selectedGesture = twoHandLetters[index];
      maxProb = 0.75;
    }

    if (selectedGesture) {
      mockProbs[selectedGesture] = maxProb + Math.random() * 0.08;
      setDebugMessage(`✓ ${selectedGesture} detected`);
    } else {
      setDebugMessage("⚠️ Unclear gesture");
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
      state.stabilityBuffer.push(gesture);

      if (state.predictionBuffer.length > CONFIG.BUFFER_SIZE) {
        state.predictionBuffer.shift();
      }
      if (state.stabilityBuffer.length > 5) {
        state.stabilityBuffer.shift();
      }

      const uniqueGestures = new Set(state.stabilityBuffer);
      const stability = 1 - (uniqueGestures.size - 1) / 4;
      setGestureStability(Math.max(0, stability));

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
        state.stabilityBuffer = [];
        state.currentGesture = null;
        setGestureStability(0);
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

      if (
        holdTime >= CONFIG.HOLD_DURATION &&
        gestureStability >= CONFIG.STABILITY_THRESHOLD
      ) {
        if (now - state.lastDetectionTime >= CONFIG.COOLDOWN_DURATION) {
          state.sequence.push(smoothed);
          setDetectedSequence(state.sequence.join(""));
          state.lastDetectionTime = now;
          state.currentGesture = null;
          state.predictionBuffer = [];
          state.stabilityBuffer = [];
          setHoldProgress(0);
          setGestureStability(0);

          setRecentDetections((prev) => [
            ...prev.slice(-4),
            {
              gesture: smoothed,
              confidence: conf,
              timestamp: now,
            },
          ]);

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
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
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
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
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
        console.error("Failed to load MediaPipe:", err);
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
          color: "#00FF88",
          lineWidth: 4,
        });
        drawLandmarks(ctx, landmarks, {
          color: "#FF00FF",
          lineWidth: 2,
          radius: 4,
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
      setDebugMessage("⚠️ No hands detected");
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
        style.radius || 5,
        0,
        2 * Math.PI,
      );
      ctx.fillStyle = style.color;
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  };

  const clearSequence = () => {
    detectionStateRef.current.sequence = [];
    setDetectedSequence("");
    setRecentDetections([]);
  };

  const undoLast = () => {
    const state = detectionStateRef.current;
    if (state.sequence.length > 0) {
      state.sequence.pop();
      setDetectedSequence(state.sequence.join(""));
      setRecentDetections((prev) => prev.slice(0, -1));
    }
  };

  const sortedProbs = Object.entries(probabilities)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  const getConfidenceColor = (conf) => {
    if (conf >= 0.7) return "text-green-400";
    if (conf >= 0.5) return "text-yellow-400";
    return "text-orange-400";
  };

  const getStabilityColor = (stab) => {
    if (stab >= 0.7) return "bg-green-500";
    if (stab >= 0.4) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 text-white p-4 md:p-6">
      {/* Header dengan glassmorphism */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl p-4 md:p-6 border border-white/20 shadow-2xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-5xl font-black flex items-center gap-3 bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                <Hand className="w-8 h-8 md:w-12 md:h-12 text-cyan-400 drop-shadow-lg" />
                BISINDO Pro
              </h1>
              <p className="text-gray-300 mt-2 text-sm md:text-base flex items-center gap-2">
                {isMobile ? (
                  <Smartphone className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
                AI-Powered Sign Language Detection |{" "}
                {isMobile ? "📱 Mobile" : "💻 Desktop"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`px-4 py-2 rounded-xl font-bold backdrop-blur-md border ${isModelLoaded ? "bg-green-500/20 border-green-500/50 text-green-300" : "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"}`}
              >
                <Zap className="w-5 h-5 inline mr-2" />
                {isModelLoaded ? "Ready" : "Loading"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Camera Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-white/10">
            <video ref={videoRef} className="hidden" playsInline />
            <canvas ref={canvasRef} className="w-full h-auto bg-black" />

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900">
                <div className="text-center">
                  <Camera className="w-20 h-20 mx-auto mb-4 animate-pulse text-cyan-400" />
                  <p className="text-2xl font-bold">Initializing Camera...</p>
                  <div className="mt-4 w-48 h-2 bg-gray-700 rounded-full mx-auto overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 animate-pulse"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Gesture Detection Overlay */}
            <div className="absolute top-4 left-4 right-4">
              <div className="backdrop-blur-xl bg-black/60 rounded-2xl p-4 border border-white/20">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    {currentGesture &&
                    confidence >= CONFIG.CONFIDENCE_THRESHOLD ? (
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-8 h-8 text-green-400 animate-pulse" />
                        <div>
                          <div className="text-3xl md:text-4xl font-black text-green-400">
                            {currentGesture}
                          </div>
                          <div
                            className={`text-sm ${getConfidenceColor(confidence)}`}
                          >
                            {(confidence * 100).toFixed(1)}% confident
                          </div>
                        </div>
                      </div>
                    ) : currentGesture ? (
                      <div className="flex items-center gap-3">
                        <Activity className="w-7 h-7 text-orange-400 animate-pulse" />
                        <div>
                          <div className="text-2xl md:text-3xl font-bold text-orange-400">
                            Detecting: {currentGesture}
                          </div>
                          <div className="text-sm text-gray-400">
                            {(confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xl md:text-2xl text-gray-400 flex items-center gap-2">
                        <Circle className="w-6 h-6 animate-pulse" />
                        Waiting for gesture...
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="backdrop-blur-sm bg-white/10 rounded-lg px-3 py-2">
                      <Hand className="w-6 h-6 inline mr-2 text-cyan-400" />
                      <span className="text-2xl font-bold">{handsCount}</span>
                    </div>
                  </div>
                </div>

                {/* Stability Indicator */}
                {gestureStability > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Gesture Stability</span>
                      <span>{(gestureStability * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${getStabilityColor(gestureStability)}`}
                        style={{ width: `${gestureStability * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Progress Bars */}
                {holdProgress > 0 ? (
                  <div>
                    <div className="flex justify-between text-xs text-gray-300 mb-2">
                      <span className="font-semibold">Hold Progress</span>
                      <span>{(holdProgress * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden backdrop-blur-sm">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-100 shadow-lg shadow-green-500/50"
                        style={{ width: `${holdProgress * 100}%` }}
                      />
                    </div>
                  </div>
                ) : cooldownProgress < 1 ? (
                  <div>
                    <div className="flex justify-between text-xs text-gray-300 mb-2">
                      <span className="font-semibold">Cooldown</span>
                      <span>{((1 - cooldownProgress) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-100"
                        style={{ width: `${(1 - cooldownProgress) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Sequence Display */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="backdrop-blur-xl bg-black/60 rounded-2xl p-4 border border-white/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400 font-semibold">
                    DETECTED SEQUENCE
                  </div>
                  <div className="text-xs text-gray-400">
                    Length: {detectedSequence.length}
                  </div>
                </div>
                <div className="text-2xl md:text-3xl font-bold text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text min-h-[40px] break-all mb-3">
                  {detectedSequence || "(empty)"}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={clearSequence}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold shadow-lg hover:shadow-red-500/50 active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                  <button
                    onClick={undoLast}
                    className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold shadow-lg hover:shadow-yellow-500/50 active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Undo
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Enter Button */}
          {isMobile && (
            <div className="backdrop-blur-xl bg-gradient-to-r from-blue-900/40 to-violet-900/40 rounded-2xl p-4 border border-white/20">
              <button
                onClick={forceAddGesture}
                disabled={!currentGesture || confidence < 0.2}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg ${
                  currentGesture && confidence > 0.2
                    ? "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 active:scale-95 shadow-blue-500/50"
                    : "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                }`}
              >
                <Circle className="w-6 h-6" />
                FORCE ADD GESTURE
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">
                Tap to manually add current gesture
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-blue-900/30 to-violet-900/30 rounded-2xl p-4 md:p-5 border border-white/20">
            <h3 className="font-bold mb-3 flex items-center gap-2 text-lg">
              {isMobile ? (
                <Smartphone className="w-5 h-5 text-cyan-400" />
              ) : (
                <Monitor className="w-5 h-5 text-cyan-400" />
              )}
              📋 {isMobile ? "Mobile" : "Desktop"} Instructions
            </h3>
            <ul className="text-sm space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400 font-bold">•</span>
                <span>
                  Hold gesture steady for ~0.6s to register automatically
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 font-bold">•</span>
                <span>Wait for cooldown before next gesture</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">•</span>
                <span>Stability indicator shows gesture consistency</span>
              </li>
              {isMobile ? (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">📱</span>
                    <span className="font-semibold text-cyan-300">
                      Tap "FORCE ADD" button to manually add gesture
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>Ensure good lighting and hold phone steady</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 font-bold">⌨️</span>
                    <span className="font-semibold text-green-300">
                      Press ENTER key to manually add gesture
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>Position camera at chest level for best results</span>
                  </li>
                </>
              )}
              <li className="flex items-start gap-2">
                <span className="text-orange-400 font-bold">•</span>
                <span>No gesture for 1.8s = auto space</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 font-bold">ℹ️</span>
                <span className="text-xs text-gray-400">{debugMessage}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Top Probabilities */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-2xl p-5 border border-white/20 shadow-xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              Top Predictions
            </h3>
            <div className="space-y-3">
              {sortedProbs.length > 0 ? (
                sortedProbs.map(([letter, prob], idx) => (
                  <div key={letter} className="group">
                    <div className="flex justify-between text-sm mb-1.5">
                      <span
                        className={`font-bold text-lg ${idx === 0 ? "text-cyan-400" : "text-gray-300"}`}
                      >
                        {letter}
                      </span>
                      <span
                        className={`font-semibold ${getConfidenceColor(prob)}`}
                      >
                        {(prob * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden backdrop-blur-sm">
                      <div
                        className={`h-full transition-all duration-300 ${
                          idx === 0
                            ? "bg-gradient-to-r from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/50"
                            : "bg-gradient-to-r from-gray-500 to-gray-600"
                        }`}
                        style={{ width: `${prob * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No detections yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-2xl p-5 border border-white/20 shadow-xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-violet-400" />
              Live Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-gray-400 text-sm">Sequence Length</span>
                <span className="font-bold text-xl text-cyan-400">
                  {detectedSequence.length}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-gray-400 text-sm">Hands Detected</span>
                <span className="font-bold text-xl text-green-400">
                  {handsCount}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-gray-400 text-sm">Confidence</span>
                <span
                  className={`font-bold text-xl ${getConfidenceColor(confidence)}`}
                >
                  {(confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-gray-400 text-sm">Stability</span>
                <span
                  className={`font-bold text-xl ${getConfidenceColor(gestureStability)}`}
                >
                  {(gestureStability * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-gray-400 text-sm">Device Mode</span>
                <span className="font-bold text-base">
                  {isMobile ? "📱 Mobile" : "💻 Desktop"}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Detections */}
          {recentDetections.length > 0 && (
            <div className="backdrop-blur-xl bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-2xl p-5 border border-green-500/20 shadow-xl">
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-green-300">
                <CheckCircle2 className="w-5 h-5" />
                Recent Detections
              </h3>
              <div className="space-y-2">
                {recentDetections
                  .slice()
                  .reverse()
                  .map((det, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                    >
                      <span className="font-bold text-2xl text-green-400">
                        {det.gesture}
                      </span>
                      <span className="text-xs text-gray-400">
                        {(det.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-yellow-900/20 to-orange-900/20 rounded-2xl p-4 border border-yellow-500/20 shadow-xl">
            <p className="font-bold mb-2 text-yellow-300 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Pro Tips
            </p>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>• Higher stability = better accuracy</li>
              <li>• Keep hand in frame center</li>
              <li>• Good lighting is crucial</li>
              <li>• Hold gesture steady until green bar fills</li>
              <li>• Mock ML model - use real model for 99% accuracy</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

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