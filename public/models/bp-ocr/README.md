# BP OCR Model (TensorFlow.js Layers Format)

This directory should contain the TensorFlow.js model files converted from
the [BPimageTranscribe](https://github.com/cliffordlab/BPimageTranscribe)
Keras model (`best_model.h5`).

## Conversion

```bash
pip install tensorflowjs
tensorflowjs_converter --input_format=keras best_model.h5 public/models/bp-ocr/
```

After conversion, this directory should contain:

- `model.json` – model topology and weight manifest
- `group1-shard1of1.bin` (or multiple shards) – binary weight data

## Model Details

- **Input**: 180 × 80 × 1 grayscale image (float32, pixel values normalised to 0–1)
- **Output**: single float regression value (0–999) representing a BP reading (SYS or DIA)
- **Source**: Clifford Lab – BPimageTranscribe (CNN trained on Omron LCD displays)
