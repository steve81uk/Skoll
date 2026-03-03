import pandas as pd
import numpy as np
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler
import os

print("=" * 70)
print("🧠 SKÖLL-TRACK GEN-2: NEURAL TRAINING SEQUENCE (WINDOWS BYPASS)")
print("=" * 70)

# 1. Load the raw CSV
data_path = 'C:/copilot_cli/aurora-live/scripts/data-mining/historical/training_set_v1.csv'
if not os.path.exists(data_path):
    print(f"🚨 Error: {data_path} not found.")
    exit()

df = pd.read_csv(data_path)
print(f"✓ Loaded {len(df)} raw records.")

# 2. Map YOUR specific CSV headers
rename_map = {
    'Scalar B, nT': 'bt',
    'BZ, nT (GSM)': 'bz',
    'SW Proton Density, N/cm^3': 'density',
    'SW Plasma Speed, km/s': 'speed',
    'Kp index': 'kp'
}
df.rename(columns=rename_map, inplace=True)

# 3. Purge the "Ghost Data" (999.9 and 9999) using Linear Interpolation
print("🔧 Scrubbing sensor anomalies (999.9)...")
df.replace([999.9, 9999.0, 999.0], np.nan, inplace=True)

# Only interpolate numeric columns to prevent pandas warnings
numeric_cols = df.select_dtypes(include=[np.number]).columns
df[numeric_cols] = df[numeric_cols].interpolate(method='linear', limit_direction='both')

# 4. Engineer the Wolf-Formula (Ψ) Target Column
print("⚗️ Calculating Wolf-Formula (Ψ) for historical data...")
df['wolf_formula'] = (df['speed']**1.33 * df['bt']**0.66) / 1000

# Drop any edge rows that still have NaNs
features = ['speed', 'density', 'bt', 'bz', 'kp']
target = 'wolf_formula'
df.dropna(subset=features + [target], inplace=True)

# 5. Feature Selection & Normalisation
scaler_X = MinMaxScaler()
scaler_y = MinMaxScaler()

X_scaled = scaler_X.fit_transform(df[features])
y_scaled = scaler_y.fit_transform(df[[target]])

# 6. Time-Series Windowing (Lookback 24h -> Predict 12h)
print("⏳ Structuring 24-hour time windows... (This takes a moment)")
def create_sequences(X_data, y_data, lookback=24, horizon=12):
    X_seq, y_seq = [], []
    # Using a step of 2 to speed up window creation slightly
    for i in range(0, len(X_data) - lookback - horizon, 2):
        X_seq.append(X_data[i : i + lookback])
        y_seq.append(y_data[i + lookback + horizon, 0])
    return np.array(X_seq), np.array(y_seq)

X_seq, y_seq = create_sequences(X_scaled, y_scaled)

# 70/30 Train/Test Split
split = int(0.7 * len(X_seq))
X_train, X_test = X_seq[:split], X_seq[split:]
y_train, y_test = y_seq[:split], y_seq[split:]

# 7. LSTM Architecture
print("🏗️ Building LSTM Architecture...")
model = tf.keras.Sequential([
    tf.keras.layers.LSTM(64, return_sequences=True, input_shape=(24, len(features))),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.LSTM(32),
    tf.keras.layers.Dense(1, activation='linear')
])

model.compile(optimizer='adam', loss='mse', metrics=['mae'])

print("🚀 Launching Neural Training Loop...")
model.fit(X_train, y_train, epochs=5, batch_size=256, validation_data=(X_test, y_test))

# 8. Save Native Keras Model (Bypassing TFJS import error)
export_file = 'skoll_model.h5'
model.save(export_file)

print("=" * 70)
print(f"✅ Mission Success: Native Neural weights saved to {export_file}")
print("=" * 70)