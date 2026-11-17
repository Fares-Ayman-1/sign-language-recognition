# Results

Generated from MLflow on 2026-11-16 21:39 UTC by `python -m islr.report`.
Validation: **18022 videos from 4 signers never seen in training** (participants [4718, 26734, 37779, 61333]); 76455 videos from the other 17 signers were used for training. Metric: accuracy over 250 signs (the competition metric is top-1 accuracy).

| Model | Top-1 | Top-5 | MLflow run |
|---|---:|---:|---|
| Conv1D + Transformer | **0.7552** | 0.8578 | `385e77e0d3424d8bbc455256a4e64d2c` |
| Bag of frames (MLP on time-averaged features) | 0.6653 | 0.8437 | `a3a3d84ee34641b68284b6cc49b73571` |
| Most frequent sign | 0.0041 | | `a3a3d84ee34641b68284b6cc49b73571` |

## Hardest and easiest signs (top-1 on the held-out signers)

Hardest: glasswindow 0.27, awake 0.29, jeans 0.33, that 0.40, mitten 0.41, there 0.41, fast 0.44, person 0.45, vacuum 0.46, kiss 0.46.

Easiest: shirt 0.96, high 0.96, shhh 0.96, radio 0.97, water 0.99.

## Most frequent confusions

| True sign | Predicted | Times | Of |
|---|---|---:|---:|
| awake | wake | 37 | 75 |
| glasswindow | tooth | 34 | 78 |
| that | stay | 30 | 67 |
| cat | kitty | 25 | 75 |
| mouth | lips | 21 | 73 |
| pencil | pen | 20 | 70 |
| quiet | shhh | 19 | 71 |
| scissors | cut | 19 | 74 |
| goose | bird | 19 | 78 |
| person | beside | 19 | 53 |

## Training (from the run's parameters and history)

- 2 stages of 3 depthwise Conv1D blocks (kernel 17) + 1 Transformer block (4 heads), width 192, 2,100,922 parameters; at most 64 frames
- 100 epochs, batch 64, AdamW (peak learning rate 0.001, weight decay 0.05), label smoothing 0.2, mixed precision True, on Tesla T4
- Final epoch scores are reported (no checkpoint picked on validation). The best validation check was epoch 95 at 0.7557; total time 97 minutes
- Source: kaggle:faresayman1/asl-signs-conv1d-transformer-with-onnx-export v1
