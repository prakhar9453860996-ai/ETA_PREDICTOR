# 🚅 Transit ETA & Delay Prediction System

An AI-powered web frontend and high-performance prediction system for estimating vehicle and train Estimated Time of Arrival (ETA) and delay factors using a Random Forest Regressor trained on real-world transit parameters.

---

## 🌟 Key Features

1. **Interactive Live Predictor Dashboard**:
   - **Remaining Distance Slider & Direct Input**: Continuous distance from 1 to 500 km.
   - **Dynamic Speedometer Gauge**: Real-time Canvas-rendered gauge tracking speed from 0 to 140 km/h.
   - **Track Congestion Selector**: Visual level indicator (0 = Clear Track to 5 = Gridlock).
   - **Weather Condition Toggles**: Categorical conditions (0 = Clear, 1 = Rain / Mist, 2 = Severe Storm / Fog).
   - **Movement State Switch**: Toggle between in-transit (moving) and halted at a station or signal.
   - **One-Click Realistic Presets**:
     - *Express Run* (420 km @ 115 km/h, clear route)
     - *Monsoon Delay* (280 km @ 45 km/h, rain, heavy congestion)
     - *Signal Halt* (95 km @ 0 km/h, halted at signal)
     - *Dense Fog Run* (175 km @ 25 km/h, storm weather)
     - *Approaching Terminal* (28 km @ 65 km/h, clear track)

2. **Real-time Prediction & Operational Insights**:
   - **Predicted Remaining Minutes & Formatted Duration** (e.g. 197.7 mins / 3h 18m).
   - **Calculated Destination Clock Arrival** (synced to local time and calendar date).
   - **AI Confidence Score & 95% Confidence Interval** (e.g. 181.7m — 213.7m).
   - **100-Tree Decision Spread Histogram**: Live Chart.js histogram showing individual tree vote consensus.
   - **Delay Attribution Factor**: Free-flow theoretical travel time vs congestion & weather delay addition.

3. **Batch CSV Testing & Benchmark Evaluator**:
   - Drag-and-drop CSV upload or 1-click "Load Dataset Samples" from the 15,000-row benchmark dataset.
   - Computes batch predictions instantly.
   - Generates Model Performance Metrics (MAE, RMSE, R2 Score) when ground-truth target values are provided.
   - Searchable, paginated data table.
   - "Download Predictions as CSV" with computed ETA, formatted time, and errors.

4. **Model Architecture & Explainability**:
   - MDI (Mean Decrease in Impurity) Feature Importance visualizer.
   - Full model metadata: 100 Trees, Max Depth 12, Scikit-Learn.
   - Dataset distribution statistics across all 15,000 observations.

5. **REST API**:
   - `POST /api/predict`: Single-point prediction.
   - `POST /api/predict-batch`: Batch prediction for CSV uploads or row arrays.
   - `GET /api/model-info`: Architectural metadata and feature importance breakdown.
   - `GET /api/sample-data`: Benchmark samples.
   - `GET /api/dataset-stats`: Summary statistics.

---

## 🚀 How to Run

1. Open a terminal in this directory (`d:/SIH`):
   ```bash
   python app.py
   ```
2. Open your web browser at:
   ```
   http://127.0.0.1:5000
   ```

---

## 📁 Project Structure

```
d:/SIH/
├── eta_predictor_model.pkl   # Serialized Random Forest model (100 estimators, depth 12)
├── eta_dataset.csv           # 15,000-record transit dataset with ground-truth targets
├── model_engine.py           # Native NumPy prediction engine (bypasses DLL restrictions)
├── app.py                    # Flask web server & REST API
├── templates/
│   └── index.html            # Responsive Operations Center frontend
├── static/
│   ├── css/
│   │   └── style.css         # Glassmorphism, animations, custom sliders
│   └── js/
│       └── app.js            # Frontend logic, charts, gauge, and API calls
└── README.md                 # Documentation
```
