import os
import io
import csv
import json
import math
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_file, Response
from model_engine import ETAPredictorEngine

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max

# Initialize prediction engine
engine = ETAPredictorEngine('eta_predictor_model.pkl')
DATASET_PATH = 'eta_dataset.csv'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/model-info', methods=['GET'])
def model_info():
    info = engine.get_model_info()
    return jsonify({'status': 'success', 'data': info})

@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json(force=True)
        rem_km = float(data.get('remaining_km', 0))
        speed = float(data.get('current_speed_kmh', 0))
        congestion = int(data.get('congestion_score', 0))
        weather = int(data.get('weather_encoded', 0))
        halted = int(data.get('is_halted', 0))

        result = engine.predict_one(
            remaining_km=rem_km,
            current_speed_kmh=speed,
            congestion_score=congestion,
            weather_encoded=weather,
            is_halted=halted
        )

        # Compute arrival clock time
        now = datetime.now()
        eta_minutes = result['predicted_remaining_minutes']
        arrival_dt = now + timedelta(minutes=eta_minutes)
        result['estimated_arrival_clock'] = arrival_dt.strftime('%I:%M %p')
        result['estimated_arrival_date'] = arrival_dt.strftime('%d %b %Y')

        return jsonify({'status': 'success', 'data': result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/predict-batch', methods=['POST'])
def predict_batch():
    try:
        rows = []
        if 'file' in request.files:
            file = request.files['file']
            stream = io.StringIO(file.stream.read().decode('UTF-8'), newline=None)
            reader = csv.DictReader(stream)
            for row in reader:
                clean_row = {}
                for k, v in row.items():
                    clean_row[k.strip()] = v.strip()
                rows.append(clean_row)
        else:
            data = request.get_json(force=True)
            rows = data.get('rows', [])

        if not rows:
            return jsonify({'status': 'error', 'message': 'No data provided'}), 400

        predictions = []
        actuals = []
        preds_list = []

        for r in rows:
            try:
                rem_km = float(r.get('remaining_km', 0))
                speed = float(r.get('current_speed_kmh', 0))
                congestion = int(float(r.get('congestion_score', 0)))
                weather = int(float(r.get('weather_encoded', 0)))
                halted = int(float(r.get('is_halted', 0)))
            except Exception:
                continue

            pred_res = engine.predict_one(rem_km, speed, congestion, weather, halted)
            pred_val = pred_res['predicted_remaining_minutes']

            item = {
                'remaining_km': round(rem_km, 2),
                'current_speed_kmh': round(speed, 2),
                'congestion_score': congestion,
                'weather_encoded': weather,
                'is_halted': halted,
                'predicted_remaining_minutes': pred_val,
                'formatted_eta': pred_res['formatted_eta'],
                'confidence_score': pred_res['confidence_score']
            }

            if 'target_remaining_minutes' in r and r['target_remaining_minutes'] != '':
                try:
                    actual = float(r['target_remaining_minutes'])
                    item['actual_remaining_minutes'] = round(actual, 2)
                    item['error'] = round(pred_val - actual, 2)
                    actuals.append(actual)
                    preds_list.append(pred_val)
                except ValueError:
                    pass

            predictions.append(item)

        # Compute evaluation metrics if ground truth was present
        metrics = None
        if len(actuals) > 0 and len(actuals) == len(preds_list):
            diffs = [p - a for p, a in zip(preds_list, actuals)]
            mae = sum(abs(d) for d in diffs) / len(diffs)
            rmse = math.sqrt(sum(d**2 for d in diffs) / len(diffs))
            mean_actual = sum(actuals) / len(actuals)
            ss_tot = sum((a - mean_actual)**2 for a in actuals)
            ss_res = sum(d**2 for d in diffs)
            r2 = (1.0 - (ss_res / ss_tot)) if ss_tot > 0 else 0.0

            metrics = {
                'evaluated_samples': len(actuals),
                'mae': round(mae, 2),
                'rmse': round(rmse, 2),
                'r2_score': round(r2, 4)
            }

        return jsonify({
            'status': 'success',
            'count': len(predictions),
            'metrics': metrics,
            'predictions': predictions[:200],  # Limit response to 200 for fast UI display
            'total_count': len(predictions)
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/sample-data', methods=['GET'])
def sample_data():
    samples = []
    if os.path.exists(DATASET_PATH):
        with open(DATASET_PATH, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                samples.append({
                    'remaining_km': round(float(row['remaining_km']), 2),
                    'current_speed_kmh': round(float(row['current_speed_kmh']), 2),
                    'congestion_score': int(float(row['congestion_score'])),
                    'weather_encoded': int(float(row['weather_encoded'])),
                    'is_halted': int(float(row['is_halted'])),
                    'target_remaining_minutes': round(float(row['target_remaining_minutes']), 2)
                })
                count += 1
                if count >= 30:
                    break
    return jsonify({'status': 'success', 'samples': samples})

@app.route('/api/dataset-stats', methods=['GET'])
def dataset_stats():
    stats = {}
    if os.path.exists(DATASET_PATH):
        import numpy as np
        data = []
        with open(DATASET_PATH, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for r in reader:
                try:
                    data.append([
                        float(r['remaining_km']),
                        float(r['current_speed_kmh']),
                        float(r['congestion_score']),
                        float(r['weather_encoded']),
                        float(r['is_halted']),
                        float(r['target_remaining_minutes'])
                    ])
                except Exception:
                    continue
        arr = np.array(data)
        cols = ['remaining_km', 'current_speed_kmh', 'congestion_score', 'weather_encoded', 'is_halted', 'target_remaining_minutes']
        for idx, col in enumerate(cols):
            v = arr[:, idx]
            stats[col] = {
                'min': round(float(np.min(v)), 1),
                'max': round(float(np.max(v)), 1),
                'mean': round(float(np.mean(v)), 1),
                'median': round(float(np.median(v)), 1)
            }
        stats['total_records'] = len(arr)

    return jsonify({'status': 'success', 'stats': stats})

if __name__ == '__main__':
    print('Starting ETA Predictor Server on http://127.0.0.1:5000')
    app.run(host='127.0.0.1', port=5000, debug=True)
