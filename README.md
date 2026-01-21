# 🤟 SIBI Sign Language Detection System

Complete sign language detection system with:
- ✅ **Python Desktop App** (2 hands support, auto-sequence)
- ✅ **React Web App** (Standalone, no backend needed)

---

## 📦 Project Structure

```
sign-language-detection/
├── python/                          # Python Desktop App
│   ├── sign_language_app.py        # Main application
│   ├── models/
│   │   └── sign_classifier.pkl     # Your trained model
│   └── data/
│       └── dataset.pkl              # Your training data
│
└── web/                             # React Web App
    ├── src/
    │   ├── App.jsx                  # Main component
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

---

## 🐍 PART 1: PYTHON DESKTOP APP

### Features
- ✅ Support 1-2 hands simultaneously
- ✅ Auto-sequence builder (A + B + C = ABC)
- ✅ Hold-to-confirm (1 second hold required)
- ✅ Smart cooldown (1.8s between detections)
- ✅ Visual progress bars
- ✅ High accuracy with confidence threshold

### Installation

```bash
# 1. Create virtual environment
python -m venv venv

# 2. Activate
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 3. Install dependencies
pip install opencv-python mediapipe numpy scikit-learn

# 4. Copy your trained model and dataset
# Place sign_classifier.pkl in models/
# Place dataset.pkl in data/
```

### Usage

```bash
python sign_language_app.py
```

### Menu Options

**1. Collect Data**
- Collect training data for any letter A-Z
- Default: 100 samples per letter
- Press SPACE to capture, Q to quit

**2. Train Model**
- Train Random Forest classifier on collected data
- Automatic save to `models/sign_classifier.pkl`

**3. Realtime Detection (Simple)**
- Basic real-time detection
- No sequence building
- Good for testing

**4. Auto Sequence Mode** ⭐ **RECOMMENDED**
- Automatic sequence building
- Hold gesture for 1 second to register
- Auto-detects: A → B → C becomes "ABC"
- Controls:
  - **C**: Clear sequence
  - **U**: Undo last gesture
  - **Q**: Quit

### Configuration (Edit in code)

```python
# Detection parameters
CONFIDENCE_THRESHOLD = 0.82  # Higher = more accurate
HOLD_DURATION = 1.0          # Hold time in seconds
COOLDOWN_DURATION = 1.8      # Wait time between detections
BUFFER_SIZE = 8              # Smoothing buffer size
```

### Troubleshooting

**Problem**: Gestures detected incorrectly (B → A)
- **Solution**: Increase `CONFIDENCE_THRESHOLD` to 0.85-0.90
- **Solution**: Increase `HOLD_DURATION` to 1.2-1.5 seconds
- **Solution**: Train more data (200+ samples per letter)

**Problem**: Too slow to detect
- **Solution**: Decrease `HOLD_DURATION` to 0.8 seconds
- **Solution**: Decrease `COOLDOWN_DURATION` to 1.5 seconds

---

## 🌐 PART 2: REACT WEB APP

### Features
- ✅ Standalone (no Python backend)
- ✅ Real-time MediaPipe detection
- ✅ Auto-sequence building
- ✅ Beautiful UI with Tailwind CSS
- ✅ Live probability visualization
- ✅ 1-2 hands support

### Installation

```bash
cd web

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Project Setup

1. **Create new Vite project** (if starting fresh):
```bash
npm create vite@latest sign-language-web -- --template react
cd sign-language-web
```

2. **Install dependencies**:
```bash
npm install
npm install -D tailwindcss postcss autoprefixer
npm install lucide-react
npx tailwindcss init -p
```

3. **Copy all files** from artifacts:
- `src/App.jsx` (main component)
- `src/main.jsx`
- `src/index.css`
- `index.html`
- `package.json`
- `vite.config.js`
- `tailwind.config.js`

4. **Run**:
```bash
npm run dev
```

### Integrating Your Trained Model

The demo uses **mock predictions**. To use your real model:

#### Option 1: TensorFlow.js (Recommended)

```bash
# Convert your sklearn model to TensorFlow
pip install tensorflowjs sklearn2tfjs

# Convert (Python)
python convert_model.py
```

```python
# convert_model.py
import pickle
import numpy as np
from sklearn2tfjs import sklearn2tfjs

# Load your model
with open('models/sign_classifier.pkl', 'rb') as f:
    data = pickle.load(f)
    
model = data['model']
sklearn2tfjs.save_model(model, 'web/public/model/')
```

Then in `App.jsx`:
```javascript
import * as tf from '@tensorflow/tfjs';

const loadModel = async () => {
  const model = await tf.loadLayersModel('/model/model.json');
  return model;
};
```

#### Option 2: ONNX Runtime

```bash
pip install skl2onnx

# Convert to ONNX
python convert_to_onnx.py
```

```python
# convert_to_onnx.py
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import pickle

with open('models/sign_classifier.pkl', 'rb') as f:
    data = pickle.load(f)

model = data['model']
initial_type = [('float_input', FloatTensorType([None, 83]))]
onx = convert_sklearn(model, initial_types=initial_type)

with open("web/public/model.onnx", "wb") as f:
    f.write(onx.SerializeToString())
```

Then use `onnxruntime-web` in React.

#### Option 3: REST API Backend

Keep Python, add Flask API:

```python
# api.py
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/predict', methods=['POST'])
def predict():
    features = request.json['features']
    # Use your classifier
    label, conf, proba = classifier.predict(features, return_all=True)
    return jsonify({
        'gesture': label,
        'confidence': conf,
        'probabilities': proba
    })

if __name__ == '__main__':
    app.run(port=5000)
```

Then in React:
```javascript
const response = await fetch('http://localhost:5000/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ features: extractedFeatures })
});
const prediction = await response.json();
```

### Configuration (in App.jsx)

```javascript
const CONFIG = {
  CONFIDENCE_THRESHOLD: 0.82,  // Adjust accuracy
  HOLD_DURATION: 1000,         // ms to hold gesture
  COOLDOWN_DURATION: 1800,     // ms between detections
  BUFFER_SIZE: 8               // Smoothing buffer
};
```

### Deployment

```bash
# Build
npm run build

# Deploy to Vercel
npm i -g vercel
vercel

# Or deploy to Netlify
npm i -g netlify-cli
netlify deploy
```

---

## 🎯 Key Improvements

### 1. **Better Accuracy**
- ❌ **Before**: Gesture B → accidentally detects A
- ✅ **After**: High confidence threshold (82%) + hold duration (1s) + smoothing buffer

### 2. **Auto Sequence Building**
- ❌ **Before**: Manual recording
- ✅ **After**: Automatic A + B + C = "ABC"

### 3. **2 Hands Support**
- ❌ **Before**: Only 1 hand
- ✅ **After**: Detects up to 2 hands, uses best prediction

### 4. **Smart Cooldown**
- ❌ **Before**: Rapid false detections
- ✅ **After**: 1.8s cooldown prevents accidental repeats

### 5. **Visual Feedback**
- Progress bar for hold duration
- Cooldown indicator
- Real-time probabilities
- Hand count display

---

## 📊 Comparison

| Feature | Python Desktop | React Web |
|---------|---------------|-----------|
| Platform | Desktop | Browser |
| Backend | Local | Standalone |
| Model | scikit-learn | TensorFlow.js (or API) |
| Speed | Very Fast | Fast |
| Deployment | Exe/Script | Web hosting |
| Updates | Manual | Automatic |

---

## 🔧 Advanced Configuration

### Increase Accuracy

1. **Collect more data**: 200-300 samples per gesture
2. **Increase confidence threshold**: `0.85-0.90`
3. **Increase hold duration**: `1.2-1.5s`
4. **Use better model**: Try XGBoost or Neural Network

### Reduce Latency

1. **Decrease buffer size**: `5-6` samples
2. **Decrease hold duration**: `0.7-0.8s`
3. **Lower confidence threshold**: `0.75-0.78`

### Custom Gestures

Add new gestures beyond A-Z:

```python
# Python
CUSTOM_GESTURES = ['HELLO', 'THANKS', 'SORRY']
ALPHABET = list(string.ascii_uppercase) + CUSTOM_GESTURES
```

---

## 📝 License

MIT License - Free to use for any purpose

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

---

## 📞 Support

For issues or questions:
- Open GitHub issue
- Check troubleshooting section
- Review configuration options

---

## 🎉 Credits

- **MediaPipe** by Google
- **scikit-learn** for ML
- **React** + **Vite** for web
- **Tailwind CSS** for styling

---

**Happy Detecting! 🤟**