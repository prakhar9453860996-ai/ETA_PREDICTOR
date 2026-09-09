import os
import math
import numpy as np
from joblib.numpy_pickle import NumpyUnpickler

class _MockObj:
    def __init__(self, *args, **kwargs):
        pass
    def __setstate__(self, state):
        if isinstance(state, dict):
            self.__dict__.update(state)
        elif isinstance(state, tuple):
            self.__dict__['_tuple_state'] = state
        else:
            self.__dict__['_state'] = state

class _ModelUnpickler(NumpyUnpickler):
    def find_class(self, module, name):
        if 'sklearn' in module:
            return type(name, (_MockObj,), {'__module__': module})
        return super().find_class(module, name)

class ETAPredictorEngine:
    def __init__(self, model_path='eta_predictor_model.pkl'):
        self.model_path = model_path
        self.model = None
        self.feature_names = ['remaining_km', 'current_speed_kmh', 'congestion_score', 'weather_encoded', 'is_halted']
        self.feature_importances = {}
        self.tree_count = 0
        self.max_depth = 0
        self.n_samples_trained = 0
        self.load_model()

    def load_model(self):
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f'Model file not found at {self.model_path}')
        
        with open(self.model_path, 'rb') as f:
            unpickler = _ModelUnpickler(self.model_path, f, ensure_native_byte_order=True)
            self.model = unpickler.load()

        if hasattr(self.model, 'feature_names_in_'):
            self.feature_names = list(self.model.feature_names_in_)
        
        self.tree_count = len(getattr(self.model, 'estimators_', []))
        self.max_depth = getattr(self.model, 'max_depth', 12)
        self.n_samples_trained = getattr(self.model, '_n_samples', 12000)
        self._calculate_feature_importances()

    def _calculate_feature_importances(self):
        if not self.model or not hasattr(self.model, 'estimators_'):
            return
        
        n_features = len(self.feature_names)
        importances = np.zeros(n_features, dtype=np.float64)

        for est in self.model.estimators_:
            nodes = est.tree_.nodes
            for node in nodes:
                f = node['feature']
                if f >= 0:
                    lc = node['left_child']
                    rc = node['right_child']
                    n_samples = node['weighted_n_node_samples']
                    n_lc = nodes['weighted_n_node_samples'][lc]
                    n_rc = nodes['weighted_n_node_samples'][rc]
                    dec = n_samples * node['impurity'] - (n_lc * nodes['impurity'][lc] + n_rc * nodes['impurity'][rc])
                    importances[f] += dec

        total = np.sum(importances)
        if total > 0:
            importances /= total

        self.feature_importances = {
            name: float(round(imp, 4))
            for name, imp in zip(self.feature_names, importances)
        }

    def _predict_single_tree(self, tree, x):
        node_id = 0
        nodes = tree.nodes
        while True:
            feat = nodes['feature'][node_id]
            if feat == -2 or nodes['left_child'][node_id] == -1:
                return float(tree.values[node_id, 0, 0])
            if x[feat] <= nodes['threshold'][node_id]:
                node_id = nodes['left_child'][node_id]
            else:
                node_id = nodes['right_child'][node_id]

    def predict_one(self, remaining_km, current_speed_kmh, congestion_score, weather_encoded, is_halted):
        x = [
            float(remaining_km),
            float(current_speed_kmh),
            int(congestion_score),
            int(weather_encoded),
            int(is_halted)
        ]

        tree_preds = [self._predict_single_tree(est.tree_, x) for est in self.model.estimators_]
        
        mean_pred = float(np.mean(tree_preds))
        std_pred = float(np.std(tree_preds))
        median_pred = float(np.median(tree_preds))
        min_pred = float(np.min(tree_preds))
        max_pred = float(np.max(tree_preds))

        ci_lower = max(0.0, float(round(mean_pred - 1.96 * std_pred, 2)))
        ci_upper = float(round(mean_pred + 1.96 * std_pred, 2))

        effective_speed = max(float(current_speed_kmh), 1.0)
        theoretical_minutes = (float(remaining_km) / effective_speed) * 60.0
        delay_minutes = max(0.0, mean_pred - theoretical_minutes)

        cv = (std_pred / mean_pred) if mean_pred > 0 else 0
        confidence_score = max(60.0, min(99.0, round(100.0 - (cv * 100.0), 1)))

        return {
            'predicted_remaining_minutes': round(mean_pred, 2),
            'median_minutes': round(median_pred, 2),
            'formatted_eta': self._format_duration(mean_pred),
            'std_deviation': round(std_pred, 2),
            'ci_95': {'lower': ci_lower, 'upper': ci_upper},
            'min_tree_vote': round(min_pred, 2),
            'max_tree_vote': round(max_pred, 2),
            'confidence_score': confidence_score,
            'theoretical_minutes': round(theoretical_minutes, 2),
            'delay_minutes': round(delay_minutes, 2),
            'tree_distribution': [round(p, 1) for p in tree_preds],
            'input': {
                'remaining_km': remaining_km,
                'current_speed_kmh': current_speed_kmh,
                'congestion_score': congestion_score,
                'weather_encoded': weather_encoded,
                'is_halted': is_halted
            }
        }

    def predict_batch(self, rows):
        results = []
        for r in rows:
            res = self.predict_one(
                remaining_km=r.get('remaining_km', 0),
                current_speed_kmh=r.get('current_speed_kmh', 0),
                congestion_score=r.get('congestion_score', 0),
                weather_encoded=r.get('weather_encoded', 0),
                is_halted=r.get('is_halted', 0)
            )
            target = r.get('target_remaining_minutes')
            if target is not None:
                try:
                    res['actual_minutes'] = round(float(target), 2)
                    res['error'] = round(res['predicted_remaining_minutes'] - float(target), 2)
                except (ValueError, TypeError):
                    pass
            results.append(res)
        return results

    def _format_duration(self, minutes):
        if minutes < 0:
            return '0m'
        hrs = int(minutes // 60)
        mins = int(round(minutes % 60))
        if mins == 60:
            hrs += 1
            mins = 0
        if hrs > 0:
            return f'{hrs}h {mins}m'
        return f'{mins}m'

    def get_model_info(self):
        return {
            'model_type': 'RandomForestRegressor',
            'n_estimators': self.tree_count,
            'max_depth': self.max_depth,
            'trained_samples': self.n_samples_trained,
            'feature_names': self.feature_names,
            'feature_importances': self.feature_importances
        }
