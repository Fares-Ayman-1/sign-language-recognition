# Monitoring report

Reference: 76455 training sequences. Current: 300 sequences. Length PSI expected from sampling alone: about 0.027.

| Check | Kind | Value | Threshold | Result |
|---|---|---:|---:|---|
| length_psi | input | 0.2018 | 0.2 | warn |
| missing_dominant_hand | input | 0.0668 | 0.15 | pass |
| missing_lips | input | 0.0083 | 0.15 | pass |
| missing_pose | input | 0.0000 | 0.15 | pass |
| confidence_drop | performance | -0.0208 | 0.1 | pass |

**Input drift, no retrain yet:** the inputs changed but confidence held. Check a labelled sample from the new setting before retraining.
